import { createConnection } from 'node:net'
import type { ClusterLine, ClusterReply } from '@ham2k/extension-sdk'

interface ClusterTelnetOptions {
  host: string
  port: number
  call: string
  timeoutMs: number
  onLine(line: ClusterLine): void
  onClose?(reason: string): void
}

export interface ClusterTelnetSession {
  readonly call: string
  send(command: string): Promise<ClusterReply>
  close(): void
}

const iac = 255
const wont = 252
const will = 251
const dont = 254
const doOption = 253
const subnegotiation = 250
const endSubnegotiation = 240
const loginPrompt = /\b(?:callsign|call|login)\s*:\s*$/i
const passwordPrompt = /\bpassword\s*:\s*$/i
const promptQuietMs = 300
const maxLineLength = 64 * 1024

function telnetText(rejectOption: (command: number, option: number) => void) {
  let state: 'text' | 'command' | 'option' | 'subnegotiation' | 'subnegotiationIac' = 'text'
  let command = 0

  return (bytes: Buffer) => {
    let text = ''
    for (const byte of bytes) {
      switch (state) {
        case 'text':
          if (byte === iac) state = 'command'
          else if (byte !== 13 && byte !== 0) text += String.fromCharCode(byte)
          break
        case 'command':
          if (byte >= will && byte <= dont) {
            command = byte
            state = 'option'
          } else if (byte === subnegotiation) {
            state = 'subnegotiation'
          } else {
            if (byte === iac) text += String.fromCharCode(iac)
            state = 'text'
          }
          break
        case 'option':
          if (command === will) rejectOption(dont, byte)
          if (command === doOption) rejectOption(wont, byte)
          state = 'text'
          break
        case 'subnegotiation':
          if (byte === iac) state = 'subnegotiationIac'
          break
        case 'subnegotiationIac':
          state = byte === endSubnegotiation ? 'text' : 'subnegotiation'
          break
      }
    }
    return text
  }
}

function isCommandPrompt(line: string, call: string) {
  const trimmed = line.trim()
  if (!trimmed.endsWith('>')) return false
  const [addressee, de, node] = trimmed.split(/\s+/)
  return Boolean(node && addressee.toUpperCase() === call && de.toLowerCase() === 'de')
}

/** Connect the harness to a DX cluster as an ordinary Telnet client. */
export async function connectClusterTelnet({
  host,
  port,
  call: loginCall,
  timeoutMs,
  onLine,
  onClose,
}: ClusterTelnetOptions): Promise<ClusterTelnetSession> {
  const call = loginCall.trim().toUpperCase()
  if (!/^[A-Z0-9]+(?:[-/][A-Z0-9]+)*$/.test(call)) throw new Error('Invalid cluster callsign.')
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Invalid cluster timeout.')

  const socket = createConnection({ host, port })
  const decode = telnetText((command, option) => socket.write(Buffer.from([iac, command, option])))
  let completeLogin!: () => void
  let rejectLogin!: (error: Error) => void
  const login = new Promise<void>((resolve, reject) => {
    completeLogin = resolve
    rejectLogin = reject
  })
  let loggedIn = false
  let callSent = false
  let closed = false
  let pending = ''
  let seq = 0
  let promptTimer: NodeJS.Timeout | undefined
  let queue: Promise<unknown> = Promise.resolve()
  let command:
    | {
        lines: string[]
        timer: NodeJS.Timeout
        resolve(reply: ClusterReply): void
      }
    | undefined

  const loginTimer = setTimeout(() => {
    stop(
      callSent
        ? 'The node did not return a command prompt.'
        : 'The node did not ask for a callsign.',
    )
  }, timeoutMs)

  function finishCommand(ok: boolean, error?: string, message?: string) {
    const active = command
    if (!active) return
    command = undefined
    clearTimeout(active.timer)
    active.resolve({ ok, lines: active.lines, error, message })
  }

  function stop(reason: string, graceful = false) {
    if (closed) return
    closed = true
    clearTimeout(loginTimer)
    clearTimeout(promptTimer)
    if (!loggedIn) rejectLogin(new Error(reason))
    finishCommand(false, 'disconnected', reason)
    if (graceful && loggedIn && !socket.destroyed) {
      socket.end('bye\r\n')
      socket.destroySoon()
    } else {
      socket.destroy()
      onClose?.(reason)
    }
  }

  function receive(line: string) {
    onLine({ seq: ++seq, at: Date.now(), text: line })
    if (callSent && isCommandPrompt(line, call)) {
      if (!loggedIn) {
        loggedIn = true
        clearTimeout(loginTimer)
        completeLogin()
      }
      finishCommand(true)
      return
    }
    command?.lines.push(line)
  }

  function receivePending() {
    const line = pending
    pending = ''
    receive(line)
  }

  socket.on('data', (bytes: Buffer) => {
    if (closed) return
    try {
      const text = decode(bytes)
      if (!text) return
      clearTimeout(promptTimer)
      const lines = (pending + text).split('\n')
      pending = lines.pop() ?? ''
      if (pending.length > maxLineLength || lines.some((line) => line.length > maxLineLength)) {
        stop('The node sent an oversized cluster line.')
        return
      }
      for (const line of lines) receive(line)
      if (callSent && isCommandPrompt(pending, call)) {
        receivePending()
        return
      }
      if (loggedIn) return
      const partial = pending.trim().length > 0
      const prompt = partial ? pending : ([...lines].reverse().find((line) => line.trim()) ?? '')
      if (passwordPrompt.test(prompt) || (!callSent && loginPrompt.test(prompt))) {
        // A pause distinguishes a real prompt from a banner split mid-sentence.
        promptTimer = setTimeout(() => {
          if (partial) receivePending()
          if (passwordPrompt.test(prompt)) {
            stop('The node requires a password for this callsign.')
            return
          }
          callSent = true
          socket.write(`${call}\r\n`)
        }, promptQuietMs)
      }
    } catch (error) {
      stop(String(error))
    }
  })
  socket.on('error', (error) => stop(error.message))
  socket.on('close', () => stop('The node closed the connection.'))

  function send(line: string): Promise<ClusterReply> {
    const result = queue.then(() => {
      if (closed) return { ok: false, lines: [], error: 'disconnected' }
      // The harness sends ASCII commands, one per line.
      if (!line.trim() || /[^\x20-\x7e]/.test(line)) {
        return { ok: false, lines: [], error: 'invalidCommand' }
      }
      return new Promise<ClusterReply>((resolve) => {
        const timer = setTimeout(() => {
          finishCommand(false, 'timeout', 'The node did not confirm the command with a prompt.')
          // A late prompt could otherwise be mistaken for the next command's reply.
          stop('A cluster command timed out.')
        }, timeoutMs)
        command = { lines: [], timer, resolve }
        socket.write(`${line}\r\n`)
      })
    })
    queue = result
    return result
  }

  await login
  return { call, send, close: () => stop('The session was closed.', true) }
}
