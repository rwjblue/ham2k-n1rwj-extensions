import { describe, expect, it } from 'vitest'
import { createActivity } from '../src/activity.ts'
import type { Roster } from '../src/model.ts'

const ctx = { online: false }
const roster: Roster = {
  members: [
    {
      number: '123',
      call: 'N1ABC',
      name: 'AL',
      spc: 'MA',
      qth: 'Boston',
      suffix: 'S',
      oldCalls: [],
      status: 'A',
    },
  ],
  source: 'test',
  revision: '1',
  downloadedAt: 1,
}
describe('optional SKCC activity', () => {
  it('does not place contest exchange fields into an unrelated POTA operation', async () => {
    expect(
      await createActivity(() => roster).loggingControls?.(
        { operation: { refs: [{ type: 'potaActivation', ref: 'US-0001' }] } },
        ctx,
      ),
    ).toEqual([])
  })
  it('suggests roster exchange values without attesting that an exchange happened', async () => {
    const controls = await createActivity(() => roster).loggingControls?.(
      {
        operation: { refs: [{ type: 'skcc', ref: 'general' }] },
        qso: { their: { call: 'N1ABC' } },
      },
      ctx,
    )
    expect(controls?.find((control) => control.key.endsWith('/number'))?.input).toMatchObject({
      suggestedValue: '123S',
    })
    expect(
      controls?.find((control) => control.key.endsWith('/qualified'))?.input,
    ).not.toHaveProperty('suggestedValue')
  })
  it('keeps explicit clearing and operator corrections through lookup and save', async () => {
    const activity = createActivity(
      () => roster,
      () => ({ myNumber: '99', myName: 'ME', myKey: 'SK' }),
    )
    const operation = { refs: [{ type: 'skcc', ref: 'general', ourNumber: '' }] }
    const qso = {
      their: { call: 'N1ABC' },
      refs: [{ type: 'skcc', number: '', name: 'BOB', spc: '' }],
    }
    const controls = await activity.loggingControls?.({ operation, qso }, ctx)
    expect(controls?.find((control) => control.key.endsWith('/number'))?.input).toMatchObject({
      suggestedValue: undefined,
    })
    expect(await activity.processQsoBeforeSave?.({ operation, qso }, ctx)).toMatchObject({
      our: { skcc: { number: '', name: 'ME' } },
      their: { skcc: { number: '', name: 'BOB', spc: '' } },
    })
  })
  it('clearly discloses SKS assistance limits in its operation setup', async () => {
    const controls = await createActivity(() => roster).operationControls?.(
      { operation: { refs: [{ type: 'skcc', ref: 'sks:2026-10' }] } },
      ctx,
    )
    expect(JSON.stringify(controls)).toContain('Unassisted')
    expect(JSON.stringify(controls)).toContain('cannot switch off other extensions')
  })
  it('reopens setup with all saved values including deliberate false and blank fields', async () => {
    const saved = {
      type: 'skcc',
      ref: 'wes:2025-10',
      ourPower: 5,
      ourGrid: 'FN42',
      ourKeyDeclared: false,
      captureDetails: true,
      themeName: '',
      themeMode: 'additive',
      themeBonus: 0,
    }
    const controls = await createActivity(() => roster).operationControls?.(
      { operation: { refs: [saved] } },
      ctx,
    )
    const input = controls?.[0]?.input
    if (input?.kind !== 'form') throw new Error('Missing setup form')
    for (const [key, value] of Object.entries(saved)) {
      if (key === 'type') continue
      expect(
        input.form.elements.find((element) => element.type === 'field' && element.key === key),
      ).toMatchObject({ value })
    }
  })
})
