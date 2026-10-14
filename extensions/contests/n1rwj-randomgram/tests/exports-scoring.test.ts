import type { HookContext } from '@ham2k/extension-sdk'
import { hooks } from '@ham2k/extension-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sentGroup } from '../src/exchange.ts'
import { createExports, receivedSubmission, submissionText } from '../src/exports.ts'
import { type Qson, REF_TYPE } from '../src/model.ts'
import { createScorer, createScoring } from '../src/scoring.ts'

const ctx: HookContext = { online: false, locale: 'en' }
const stamp = Date.parse('2026-10-18T00:00:00Z')
const manifest = { key: 'n1rwj-randomgram' }

function operation(fields: Qson = {}): Qson {
  return {
    uuid: 'randomgram-test',
    stationCall: 'N1RWJ',
    startAtMillis: stamp,
    refs: [
      {
        type: REF_TYPE,
        ref: 'RG#48',
        alphabet: 'alphanumeric',
        txGroups: ['0O19A', 'BC234', 'ZZZZZ'],
        ...fields,
      },
    ],
  }
}

function contact(uuid: string, theirGroup = 'A012O', ourSerial = 1, fields: Qson = {}): Qson {
  return {
    uuid,
    their: { call: 'K1ABC' },
    band: '20m',
    mode: 'CW',
    startAtMillis: stamp + Number(ourSerial) * 1000,
    refs: [{ type: REF_TYPE, theirGroup, ourSerial }],
    ...fields,
  }
}

function listening(uuid = 'listening', theirGroup = 'QWERT'): Qson {
  return {
    uuid,
    band: 'event',
    event: { event: 'note', note: 'RandomGram listening-only entry' },
    refs: [{ type: REF_TYPE, listeningOnly: true, theirGroup }],
    startAtMillis: stamp,
  }
}

afterEach(() => vi.restoreAllMocks())

describe('RandomGram submission', () => {
  it('exports only unique received groups including listening-only notes', async () => {
    const { exports } = createExports(manifest)
    const qsos = [
      contact('first'),
      contact('repeat', 'A012O', 2),
      contact('invalid', 'AA?12', 2),
      contact('deleted', 'DELET', 3, { deleted: true }),
      contact('different-event', 'OTHER', 3, {
        refs: [{ type: REF_TYPE, ref: 'RG#43', theirGroup: 'OTHER', ourSerial: 3 }],
      }),
      contact('unrelated', 'WRONG', 3, { refs: [{ type: 'cwt', theirGroup: 'WRONG' }] }),
      contact('wrong-mode', 'SSBXX', 3, { mode: 'SSB' }),
      contact('warc', 'WARCC', 3, { band: '30m' }),
      { uuid: 'ordinary-note', band: 'event', refs: [{ type: REF_TYPE, theirGroup: 'NOTES' }] },
      listening(),
    ]
    const generated = await exports.generateExport(
      { exportType: `${REF_TYPE}-text`, operation: operation(), qsos },
      ctx,
    )
    expect(generated.content).toBe('N1RWJ\n\nA012O\nQWERT\n')
    expect(generated.filename).toContain('N1RWJ')
    expect(generated.filename).toContain('RG#48')
    expect(generated.filename).toMatch(/\.txt$/)
    expect(generated.content).not.toContain('0O19A')
    expect(generated.content).not.toContain('BC234')
    expect(receivedSubmission(operation(), qsos)).toEqual({
      groups: ['A012O', 'QWERT'],
      repeated: 1,
      invalid: 3,
    })
    const options = await exports.suggestExportOptions({ operation: operation(), qsos }, ctx)
    expect(options[0]?.qsoCount).toBe(2)
    expect(options[0]?.label).toContain('1 repeated groups omitted')
    expect(options[0]?.label).toContain('3 invalid entries omitted')
    expect(options[1]?.qsoCount).toBe(5)
  })

  it('uses the SWL identity and selected event alphabet without transmitting supplied groups', async () => {
    const { exports } = createExports(manifest)
    const op = operation({ alphabet: 'letters', participant: ' SWL-123\nUSA ' })
    const qsos = [listening('letters', 'ABCDE'), listening('digits', '0O19A')]
    const generated = await exports.generateExport(
      { exportType: `${REF_TYPE}-text`, operation: op, qsos, compactFilenames: true },
      ctx,
    )
    expect(generated.content).toBe('SWL-123 USA\n\nABCDE\n')
    expect(generated.filename).toMatch(/SWL-123-USA.*\.txt$/)
    expect(receivedSubmission(op, qsos).invalid).toBe(1)
  })

  it('recovers listening notes omitted from the host-shaped export payload with one full-log read per call', async () => {
    const { exports } = createExports(manifest)
    const op = operation()
    const qso = contact('contact')
    const note = listening()
    const otherEvent: Qson = {
      ...listening('other-event', 'OTHER'),
      refs: [{ type: REF_TYPE, ref: 'RG#43', theirGroup: 'OTHER', listeningOnly: true }],
    }
    const deleted = { ...listening('deleted', 'DELET'), deleted: true }
    const getQsos = vi.fn(async () => [qso, note, note, otherEvent, deleted])
    const hostContext = { ...ctx, getQsos }
    const options = await exports.suggestExportOptions({ operation: op, qsos: [qso] }, hostContext)
    expect(options[0]?.qsoCount).toBe(2)
    expect(options[0]?.label).not.toContain('repeated groups omitted')
    expect(options[1]?.qsoCount).toBe(1)
    expect(getQsos).toHaveBeenCalledTimes(1)
    expect(getQsos).toHaveBeenLastCalledWith('randomgram-test')
    const generated = await exports.generateExport(
      { exportType: 'randomgram-text', operation: op, qsos: [qso] },
      hostContext,
    )
    expect(getQsos).toHaveBeenCalledTimes(2)
    expect(generated.content).toBe('N1RWJ\n\nA012O\nQWERT\n')
    expect(generated.content).not.toContain('OTHER')
    expect(generated.content).not.toContain('DELET')
  })

  it('deduplicates note UUIDs already present in the hook payload and provides text for SWL-only reports', async () => {
    const { exports } = createExports(manifest)
    const note = listening()
    const getQsos = vi.fn(async () => [note])
    const options = await exports.suggestExportOptions(
      { operation: operation(), qsos: [note] },
      { ...ctx, getQsos },
    )
    expect(options[0]?.qsoCount).toBe(1)
    expect(options[0]?.label).not.toContain('repeated groups omitted')
    expect(submissionText(operation({ participant: 'SWL-123' }), [note])).toBe('SWL-123\n\nQWERT\n')
    expect(submissionText(operation(), [])).toBe('N1RWJ\n\n')
  })

  it('does not read a log for unrelated export requests or operations without a saved UUID', async () => {
    const { exports } = createExports(manifest)
    const getQsos = vi.fn(async () => [listening()])
    const hostContext = { ...ctx, getQsos }
    await exports.suggestExportOptions({ operation: {}, qsos: [] }, hostContext)
    await exports.generateExport(
      { exportType: 'cwt-adif', operation: operation(), qsos: [] },
      hostContext,
    )
    const op = { ...operation(), uuid: '' }
    await exports.suggestExportOptions({ operation: op, qsos: [] }, hostContext)
    await exports.generateExport(
      { exportType: 'randomgram-text', operation: op, qsos: [] },
      hostContext,
    )
    expect(getQsos).not.toHaveBeenCalled()
  })

  it('refuses a submission when the full log is unavailable instead of silently dropping listening notes', async () => {
    const { exports } = createExports(manifest)
    const getQsos = vi.fn(async () => null)
    const hostContext = { ...ctx, getQsos }
    const args = { operation: operation(), qsos: [contact('contact')] }
    const message = 'The RandomGram log is unavailable. Retry before submitting received groups.'
    await expect(exports.suggestExportOptions(args, hostContext)).rejects.toThrow(message)
    await expect(
      exports.generateExport({ ...args, exportType: 'randomgram-text' }, hostContext),
    ).rejects.toThrow(message)
    expect(getQsos).toHaveBeenCalledTimes(2)
  })

  it('preserves explicit received clearing and saved literal exchanges', () => {
    const qsos = [
      contact('snapshot', '', 1, {
        refs: [{ type: REF_TYPE, ourSerial: 1 }],
        their: { call: 'K1ABC', exchange: '0OO0A' },
      }),
      contact('cleared', '', 2, { their: { call: 'K1ABC', exchange: 'OLDXX' } }),
    ]
    expect(receivedSubmission(operation(), qsos)).toEqual({
      groups: ['0OO0A'],
      repeated: 0,
      invalid: 1,
    })
  })

  it('registers independent types, honors compact filenames, and rejects unrelated requests', async () => {
    const { exports } = createExports(manifest)
    const definitions = await exports.getExportTypes()
    expect(definitions.map(({ exportType }) => exportType)).toEqual([
      'randomgram-text',
      'randomgram-adif',
    ])
    const qsos = [contact('one')]
    for (const compactFilenames of [true, false]) {
      const args = { operation: operation(), qsos, compactFilenames }
      const options = await exports.suggestExportOptions(args, ctx)
      const generated = await exports.generateExport(
        { ...args, exportType: 'randomgram-text' },
        ctx,
      )
      expect(generated.filename).toBe(options[0]?.filename)
    }
    expect(await exports.suggestExportOptions({ operation: {}, qsos }, ctx)).toEqual([])
    for (const args of [
      { operation: {}, qsos, exportType: 'randomgram-text' },
      { operation: operation(), qsos, exportType: 'adif' },
      { operation: operation(), qsos, exportType: 'cwt-adif' },
    ]) {
      expect(await exports.generateExport(args, ctx)).toEqual({
        filename: '',
        mimeType: '',
        content: '',
      })
    }
  })
})

describe('RandomGram ADIF', () => {
  it('preserves exact sent/received strings without numeric serials or invented contest IDs', async () => {
    const { adifFields } = createExports(manifest)
    const qso = contact('snapshot', 'A012O', 2, { our: { exchange: '0O19A' } })
    const fields = await adifFields.fieldsForOneQSO({ operation: operation(), qso }, ctx)
    expect(fields).toEqual([
      { name: 'STX_STRING', value: '0O19A' },
      { name: 'SRX_STRING', value: 'A012O' },
      { name: 'COMMENT', value: 'RandomGram RG#48 RX: A012O' },
    ])
    const changed = operation({ txGroups: ['WRONG', 'WRONG'] })
    expect(await adifFields.fieldsForOneQSO({ operation: changed, qso }, ctx)).toEqual(fields)
    expect(
      await adifFields.fieldsForOneQSO({ operation: operation(), qso: listening() }, ctx),
    ).toEqual([])
    expect(await adifFields.fieldsForOneQSO({ operation: {}, qso }, ctx)).toEqual([])
  })

  it('preserves malformed operator TX corrections and snapshots while leaving keying unavailable', async () => {
    const { adifFields } = createExports(manifest)
    for (const qso of [
      contact('invalid-override', 'A012O', 1, {
        refs: [{ type: REF_TYPE, ourSerial: 1, ourGroup: 'AB?DE', theirGroup: 'A012O' }],
        our: { exchange: '' },
      }),
      contact('invalid-snapshot', 'A012O', 1, { our: { exchange: 'AB?DE' } }),
    ]) {
      const fields = await adifFields.fieldsForOneQSO({ operation: operation(), qso }, ctx)
      expect(fields).toContainEqual({ name: 'STX_STRING', value: 'AB?DE' })
      expect(sentGroup(operation(), qso)).toBe('')
    }
  })

  it('delegates only actual contacts with privacy/settings/segment arguments intact', async () => {
    const invoke = vi
      .spyOn(hooks, 'invokeOne')
      .mockResolvedValue([{ key: 'adif', ok: true, value: { content: '<eoh>\n<eor>' } }])
    const { exports } = createExports(manifest)
    const op = operation()
    const qso = contact('actual')
    const exportSettings = { adifNotesTemplate: '', customTemplates: true }
    const exportData = { activity: 'RandomGram-RG#48' }
    const segments = [{ fromMillis: stamp, operation: op }]
    const getQsos = vi.fn(async () => [qso, listening()])
    const args = {
      exportType: 'randomgram-adif',
      operation: op,
      qsos: [qso, listening(), contact('deleted', 'DELET', 2, { deleted: true })],
      segments,
      includeLookupData: false,
      includePrivateData: false,
      exportSettings,
      exportData,
      exportTitle: 'RandomGram contacts',
    }
    const generated = await exports.generateExport(args, { ...ctx, getQsos })
    expect(generated.content).toBe('<eoh>\n<eor>')
    expect(generated.filename).toMatch(/\.adi$/)
    expect(getQsos).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledWith(
      'export',
      'adif',
      'generateExport',
      expect.objectContaining({
        operation: op,
        qsos: [qso],
        segments,
        includeLookupData: false,
        includePrivateData: false,
        exportSettings,
        exportData,
        exportTitle: 'RandomGram contacts',
        mainHandler: manifest.key,
      }),
    )
  })
})

describe('RandomGram group counts and warnings', () => {
  it('allows repeated calls/bands, counts literal groups, and reports organizer-adjudicated status', async () => {
    const scored = await createScoring().scoreQsos(
      {
        operation: operation(),
        qsos: [contact('one'), contact('two', 'QWERT', 2)],
      },
      ctx,
    )
    expect(scored.qsoScores.one).toMatchObject({ value: 0, dupe: false, alerts: [] })
    expect(scored.qsoScores.two).toMatchObject({ value: 0, dupe: false, alerts: [] })
    expect(scored.operationSummary.randomgram).toMatchObject({
      label: 'RandomGram groups',
      summary: '2 TX / 2 RX',
      total: 2,
      txGroups: 2,
      rxGroups: 2,
      organizerAdjudicated: false,
    })
    expect(scored.operationSummary.randomgram?.longSummary).toContain('determines the final score')
    expect(scored.daySections[0]?.scores).toEqual({})
  })

  it('warns for missing/invalid RX, invalid modes/bands, and reused TX without call duplicates', async () => {
    const scored = await createScoring().scoreQsos(
      {
        operation: operation(),
        qsos: [
          contact('one'),
          contact('missing', '', 1),
          contact('invalid', 'TOOLONG', 2),
          contact('ssb', 'SSBXX', 3, { mode: 'SSB' }),
          contact('warc', 'WARCC', 3, { band: '30m' }),
        ],
      },
      ctx,
    )
    expect(scored.qsoScores.missing).toMatchObject({
      dupe: false,
      alerts: ['Sent group already used', 'missingExchange'],
    })
    expect(scored.qsoScores.invalid?.alerts).toContain('invalidExchange')
    expect(scored.qsoScores.ssb?.alerts).toContain('invalidMode')
    expect(scored.qsoScores.warc?.alerts).toContain('invalidBand')
    expect(scored.operationSummary.randomgram?.summary).toBe('2 TX / 1 RX')
  })

  it('counts received repeats once and distinguishes RX repetition from a duplicate contact', async () => {
    const scored = await createScoring().scoreQsos(
      { operation: operation(), qsos: [contact('one'), contact('repeat', 'A012O', 2)] },
      ctx,
    )
    expect(scored.qsoScores.repeat).toMatchObject({
      value: 0,
      dupe: false,
      notices: ['Received group already recorded'],
    })
    expect(scored.operationSummary.randomgram?.summary).toBe('2 TX / 1 RX')
    expect(scored.operationSummary.randomgram?.longSummary).toContain('1 repeated received groups')
  })

  it('includes durable SWL notes and skipped groups while preventing skips from inflating TX/RX', async () => {
    const skipped: Qson = {
      uuid: 'skipped',
      band: 'event',
      startAtMillis: stamp,
      refs: [{ type: REF_TYPE, ourSerial: 1, ourGroup: '0O19A', skipped: true }],
    }
    const qsos = [skipped, listening(), contact('reused-after-skip'), contact('normal', 'OTHER', 2)]
    const scored = await createScoring().scoreQsos({ operation: operation(), qsos }, ctx)
    expect(scored.qsoScores['reused-after-skip']?.alerts).toContain('Sent group already used')
    expect(scored.operationSummary.randomgram?.summary).toBe('2 TX / 3 RX')
    expect(scored.operationSummary.randomgram?.longSummary).toContain('1 listening-only entries')
    expect(receivedSubmission(operation(), qsos).groups).toEqual(['QWERT', 'A012O', 'OTHER'])
    expect(qsos[0]?.band).toBe('event')
    expect(qsos[1]?.band).toBe('event')
  })

  it('ignores deleted rows, ordinary notes, unrelated references and other events', async () => {
    const scored = await createScoring().scoreQsos(
      {
        operation: operation(),
        qsos: [
          contact('deleted', 'DELET', 1, { deleted: true }),
          contact('unrelated', 'UNREL', 1, { refs: [{ type: 'cwt' }] }),
          contact('other-event', 'OTHER', 1, {
            refs: [{ type: REF_TYPE, ref: 'RG#43', theirGroup: 'OTHER' }],
          }),
          { uuid: 'note', band: 'event', refs: [{ type: REF_TYPE, theirGroup: 'NOTES' }] },
        ],
      },
      ctx,
    )
    expect(scored.operationSummary.randomgram?.summary).toBe('0 TX / 0 RX')
    expect(scored.qsoScores.deleted).toEqual({ value: 0 })
  })

  it('validates letters-only RX and keeps listening-only entries independent of TX setup', async () => {
    const op = operation({ alphabet: 'letters', txGroups: [] })
    const scored = await createScoring().scoreQsos(
      { operation: op, qsos: [listening('letters'), listening('digits', 'A012O')] },
      ctx,
    )
    expect(scored.operationSummary.randomgram?.summary).toBe('0 TX / 1 RX')
    expect(scored.qsoScores.letters?.alerts).toEqual([])
    expect(scored.qsoScores.digits?.alerts).toEqual(['invalidExchange'])
  })

  it('uses held checkpoints for live scoring without fetching the full log or consuming groups', async () => {
    const getQsos = vi.fn(async () => {
      throw new Error('Unexpected full-log read')
    })
    const scoring = createScoring()
    const op = operation()
    await scoring.scoreQsos(
      { operation: op, qsos: [listening(), contact('one')], checkpointKey: 'checkpoint-one' },
      ctx,
    )
    const args = {
      operation: op,
      qso: contact('candidate', 'QWERT', 2),
      resumeKey: 'checkpoint-one',
    }
    const live = await scoring.scoreQso?.(args, { ...ctx, getQsos })
    expect(live).toMatchObject({
      dupe: false,
      alerts: [],
      notices: ['Received group already recorded'],
      checkpointHeld: true,
    })
    expect(await scoring.scoreQso?.(args, { ...ctx, getQsos })).toEqual(live)
    expect(getQsos).not.toHaveBeenCalled()
    const end = await scoring.scoreQsos(
      { operation: op, qsos: [contact('two', 'OTHER', 2)], resumeKey: 'checkpoint-one' },
      ctx,
    )
    expect(end.operationSummary.randomgram?.summary).toBe('2 TX / 3 RX')
  })

  it('retains listening-only notes when the SDK cold-reads history for a live candidate', async () => {
    const getQsos = vi.fn(async () => [listening()])
    const scoring = createScoring()
    const live = await scoring.scoreQso?.(
      { operation: operation(), qso: contact('candidate', 'QWERT') },
      { ...ctx, getQsos },
    )
    expect(live?.notices).toContain('Received group already recorded')
    expect(getQsos).toHaveBeenCalledTimes(1)
  })

  it('returns no event-day numeric score from the pure scorer', () => {
    const scorer = createScorer()
    expect(
      scorer.summarizeScore(
        {
          scoresheet: scorer.startScoresheet({ operation: operation() }, ctx),
          operation: operation(),
          scope: 'day',
        },
        ctx,
      ),
    ).toEqual({})
  })
})
