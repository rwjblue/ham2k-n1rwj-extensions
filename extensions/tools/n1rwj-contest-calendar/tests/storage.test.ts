import type { JSONValue } from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { createCalendarStorage } from '../src/storage.ts'

describe('calendar persistent settings', () => {
  it('retains independent cache and panel preferences across restarts', async () => {
    const group: Record<string, JSONValue> = { untouched: 'retained' }
    const host = {
      getSettings: async () => ({
        extensions: { extension_calendar: group, extension_other: { cache: 'unrelated' } },
      }),
      setSettings: vi.fn(async (values: Record<string, JSONValue>) => {
        Object.assign(group, values)
      }),
    }
    const storage = createCalendarStorage(host, 'calendar')
    await Promise.all([
      storage.set('cache', { fetchedAt: 1234, events: [] }),
      storage.set('panel', { mode: 'CW' }),
    ])
    const restarted = createCalendarStorage(host, 'calendar')
    expect(await restarted.get('cache')).toEqual({ fetchedAt: 1234, events: [] })
    expect(await restarted.get('panel')).toEqual({ mode: 'CW' })
    expect(await restarted.get('untouched')).toBe('retained')
    expect(host.setSettings).toHaveBeenCalledWith({ panel: { mode: 'CW' } })
  })

  it('recovers after a settings read or write fails', async () => {
    const host = {
      getSettings: vi.fn().mockRejectedValueOnce(new Error('read failed')).mockResolvedValue({}),
      setSettings: vi
        .fn()
        .mockRejectedValueOnce(new Error('write failed'))
        .mockResolvedValue(undefined),
    }
    const storage = createCalendarStorage(host, 'calendar')
    await expect(storage.get('cache')).rejects.toThrow('read failed')
    expect(await storage.get('cache')).toBeNull()
    await expect(storage.set('cache', { events: [] })).rejects.toThrow('write failed')
    await storage.set('cache', { events: ['recovered'] })
    expect(await storage.get('cache')).toEqual({ events: ['recovered'] })
  })
})
