import { describe, expect, it } from 'vitest'
import { createHistoryData } from '../../../../packages/mini-contest/src/data.ts'
import { parseHistory } from '../../../../packages/mini-contest/src/history.ts'
import manifest from '../manifest.json'
import { config } from '../src/config.ts'
import { createNsHooks } from '../src/hooks.ts'
import { contact, ctx, operation } from './fixtures.ts'

// Actual 2026-08-20 file column/header shape; all contact rows are synthetic.
const header =
  '!!Order!!,Call,Name,State,UserText,\n# NAQPCW\n# NAQPRTTY\n# NAQPSSB\n# NSRTTYDUPE\n# SPRINTCW\n# SPRINTLADD\n# SPRINTNS\n'
const body = `${header}K1ABC,ANN,MA,\nKL7ABC,AL,AK,\nKH6ABC,HAL,HI,\nKP4ABC,PAT,KP4,\n9Y4ABC,TOM,9Y,\nVE3ABC,LEE,NL,\n`

describe('NS call history', () => {
  it('accepts a cached Sprint/NAQP file and preserves NS states and country prefixes', () => {
    const file = parseHistory(config, body)
    expect(file.count).toBe(6)
    expect(file.warnings).toBe(0)
    expect(file.records.KL7ABC).toEqual({ call: 'KL7ABC', name: 'AL', location: 'AK' })
    expect(file.records.KH6ABC?.location).toBe('HI')
    expect(file.records.KP4ABC?.location).toBe('KP4')
    expect(file.records['9Y4ABC']?.location).toBe('9Y')
  })
  it('keeps names but discards numeric/unsupported location hints and unrelated exchanges', () => {
    const file = parseHistory(config, `${header}K1ABC,ANN,1234,\nK2ABC,BOB,CWA,\nK3ABC,JIM,,\n`)
    expect(file.records).toEqual({
      K1ABC: { call: 'K1ABC', name: 'ANN' },
      K2ABC: { call: 'K2ABC', name: 'BOB' },
      K3ABC: { call: 'K3ABC', name: 'JIM' },
    })
    expect(file.warnings).toBe(2)
    expect(() =>
      parseHistory(config, '# CWOPS\n!!Order!!,Call,Name,Exch1\nK1ABC,ANN,1234\n'),
    ).toThrow('another contest')
  })
  it('normalizes unambiguous postal codes in the history State column only', () => {
    const file = parseHistory(config, `${header}KP4ABC,PAT,PR,\nKP2ABC,ANN,VI,\n`)
    expect(file.records.KP4ABC?.location).toBe('KP4')
    expect(file.records.KP2ABC?.location).toBe('KP2')
  })
  it('refreshes from the shared NAQP file and retains the last valid offline cache after bad refreshes', async () => {
    const data = createHistoryData(config, manifest)
    const url = 'https://supercheckhistory.com/downloads/N1MM/NAQP-CW.txt'
    expect(data.dataFile).toMatchObject({
      key: 'n1rwj-ns_history',
      url,
      fetchType: 'raw',
      maxAgeInDays: 1,
    })
    const snapshot = {
      schema: 1,
      body,
      url: 'https://n1mmwp.hamdocs.com/mmfile/get/file/SPRINTNS.txt',
      fetchedAt: '2026-10-29T12:00:00Z',
    }
    data.dataFile.onLoadRawData?.(snapshot)
    expect(data.current()?.count).toBe(6)
    await data.dataFile.rawToJSONData?.({
      body: '# NAQP-CW\n!!Order!!,Call,Name,State,UserText\nK1ABC,ANN,CT,\nKL7ABC,AL,AK,\n',
      url,
      options: {},
    })
    expect(data.current()?.records.K1ABC?.location).toBe('CT')
    await expect(
      data.dataFile.rawToJSONData?.({ body: '<html>error</html>', url, options: {} }),
    ).rejects.toThrow('Invalid')
    expect(data.current()?.records.KL7ABC?.location).toBe('AK')
    data.dataFile.onLoadRawData?.({ ...snapshot, body: 'invalid file' })
    expect(data.current()?.count).toBe(2)
    await data.dataFile.onRemoveRawData?.()
    expect(data.current()).toBeUndefined()
  })
  it('prefills names/QTHs offline without suggesting a serial and keeps current contacts ahead of the file', async () => {
    const file = parseHistory(config, body)
    const { activity, scoring } = createNsHooks(() => file)
    const controls = await activity.loggingControls?.(
      { operation, qso: { their: { call: 'K1ABC', name: 'LOOKUP', state: 'CT' } } },
      ctx,
    )
    expect(controls?.[2]?.input).toMatchObject({ suggestedValue: 'ANN' })
    expect(controls?.[3]?.input).toMatchObject({ suggestedValue: 'MA' })
    expect(controls?.[1]?.input).not.toHaveProperty('suggestedValue')
    await scoring.scoreQsos({ operation, qsos: [contact('K1ABC', '40m', 'RI')] }, ctx)
    const current = await activity.loggingControls?.(
      { operation, qso: { their: { call: 'K1ABC' } } },
      ctx,
    )
    expect(current?.[2]?.input).toMatchObject({ suggestedValue: 'BOB' })
    expect(current?.[3]?.input).toMatchObject({ suggestedValue: 'RI' })
  })
})
