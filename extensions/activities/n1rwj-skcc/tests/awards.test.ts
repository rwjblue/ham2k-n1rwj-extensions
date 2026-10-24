// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import { describe, expect, it } from 'vitest'
import { createActivity } from '../src/activity.ts'
import { analyzeAwards, evaluateQso, makeProspect } from '../src/awards.ts'
import { sprintAt } from '../src/events.ts'
import { type Member, object, type Qson, type Roster } from '../src/model.ts'

const me: Member = {
  number: '1',
  call: 'N1ME',
  name: 'Me',
  spc: 'MA',
  qth: '',
  suffix: 'S',
  oldCalls: [],
  status: 'A',
  joinDate: '2006-01-01',
  centurionDate: '2020-01-01',
  tribuneDate: '2020-02-01',
  tx8Date: '2021-01-01',
  senatorDate: '2022-01-01',
}
const them: Member = {
  ...me,
  number: '23456',
  call: 'K2YOU',
  name: 'You',
  spc: 'NY',
  oldCalls: ['N3OLD'],
  centurionDate: '2020-06-01',
  tribuneDate: '2022-01-01',
  senatorDate: '2024-01-01',
}
const roster: Roster = { members: [me, them], downloadedAt: 0, source: 'test', revision: 'one' }
function qso(changes: Qson = {}, exchange: Qson = {}, ours: Qson = {}): Qson {
  return {
    uuid: 'one',
    startAtMillis: Date.parse('2026-10-20T12:00:00Z'),
    endAtMillis: Date.parse('2026-10-20T13:00:00Z'),
    band: '40m',
    mode: 'CW',
    their: { call: 'K2YOU', rst: '579', dxcc: '291', power: 5, continent: 'NA' },
    our: {
      call: 'N1ME',
      rst: '579',
      dxcc: '1',
      power: 5,
      continent: 'NA',
      skcc: {
        number: '1S',
        name: 'Me',
        spc: 'MA',
        key: 'SK',
        qualified: true,
        keyDeclared: true,
        ...ours,
      },
    },
    refs: [
      {
        type: 'skcc',
        ref: '23456',
        number: '23456S',
        name: 'You',
        spc: 'NY',
        qualified: true,
        event: 'general',
        ...exchange,
      },
    ],
    ...changes,
  }
}

describe('SKCC historical eligibility and evidence', () => {
  it('counts factual exchanges, never membership lookup alone', () => {
    expect(evaluateQso(qso(), roster).awards.C?.ref).toBe('23456')
    const missing = evaluateQso(qso({ refs: [], their: { call: 'K2YOU' } }), roster)
    expect(missing.awards.C).toBeUndefined()
    expect(missing.issues).toContain('Both exchanged SKCC numbers are required')
  })
  it('preserves explicit clears over saved projections', () => {
    const result = evaluateQso(
      qso(
        { their: { call: 'K2YOU', skcc: { number: '23456', name: 'You', qualified: true } } },
        { number: '' },
      ),
      roster,
    )
    expect(result.number).toBe('')
    expect(result.awards.C).toBeUndefined()
  })
  it('evaluates both membership dates and approved C/Tx8/T dates at the contact', () => {
    const beforeC = evaluateQso(qso({ startAtMillis: Date.parse('2020-05-31T23:59:59Z') }), roster)
    expect(beforeC.awards.C).toBeDefined()
    expect(beforeC.awards.T).toBeUndefined()
    const atC = evaluateQso(qso({ startAtMillis: Date.parse('2020-06-01T00:00:00Z') }), roster)
    expect(atC.awards.T).toBeDefined()
    expect(atC.awards.S).toBeUndefined()
    const beforeT = evaluateQso(qso({ startAtMillis: Date.parse('2021-12-31T23:59:59Z') }), roster)
    expect(beforeT.awards.S).toBeUndefined()
    expect(
      evaluateQso(qso({ startAtMillis: Date.parse('2022-01-01T00:00:00Z') }), roster).awards.S,
    ).toBeDefined()
    const missingDate = { ...roster, members: [me, { ...them, joinDate: undefined }] }
    expect(evaluateQso(qso(), missingDate).awards.C).toBeUndefined()
  })
  it('never treats current suffix as a historical status date or threshold as an award', () => {
    const noDates = {
      ...roster,
      members: [{ ...me, centurionDate: undefined, tx8Date: undefined }, them],
    }
    const evaluation = evaluateQso(qso(), noDates)
    expect(evaluation.awards.C).toBeDefined()
    expect(evaluation.awards.T).toBeUndefined()
    expect(evaluation.awards.S).toBeUndefined()
  })
  it('deduplicates member numbers across changed calls, status and bands', () => {
    const result = analyzeAwards(
      [
        qso(),
        qso(
          {
            uuid: 'two',
            startAtMillis: Date.parse('2026-10-21T12:00:00Z'),
            band: '20m',
            their: { call: 'N3OLD' },
          },
          { number: '23456T' },
        ),
      ],
      roster,
    )
    expect(result.awards.C.total).toBe(1)
    expect(result.awards.T.total).toBe(1)
    expect(result.awards.QRP1.total).toBe(3)
    expect(result.awards.C.excluded[0]?.reasons.join(' ')).toContain('Already represented')
  })
  it('uses received state instead of home state and preserves clears', () => {
    expect(evaluateQso(qso({}, { spc: 'HI' }), roster).awards.WAS?.ref).toBe('HI')
    expect(evaluateQso(qso({}, { spc: '' }), roster).awards.WAS).toBeUndefined()
    expect(evaluateQso(qso({}, { spc: 'ON' }), roster).awards.WAS).toBeUndefined()
  })
  it('requires actual positive DXCC identifiers and preserves cleared operating entities', () => {
    expect(evaluateQso(qso(), roster).awards.DXC?.ref).toBe('291')
    expect(evaluateQso(qso({}, { dxcc: '' }), roster).awards.DXC).toBeUndefined()
    expect(evaluateQso(qso({}, { dxcc: 0 }), roster).awards.DXC).toBeUndefined()
    expect(evaluateQso(qso({}, {}, { dxcc: 'unknown' }), roster).awards.DXC).toBeUndefined()
    const mobile = qso()
    mobile.our = { ...object(mobile.our), call: 'N1ME/MM' }
    expect(evaluateQso(mobile, roster).awards.DXC).toBeUndefined()
  })
  it('requires actual event operator identity for membership awards while retaining K3Y sweep', () => {
    const special = qso(
      { startAtMillis: Date.parse('2026-01-05T12:00:00Z'), their: { call: 'K3Y/1' } },
      { event: 'k3y' },
    )
    expect(evaluateQso(special, roster).awards.C).toBeUndefined()
    expect(evaluateQso(special, roster).awards.K3Y?.ref).toBe('2026:1')
    expect(
      evaluateQso(
        qso({
          ...special,
          refs: [
            {
              type: 'skcc',
              number: '23456',
              name: 'You',
              qualified: true,
              operatorCall: 'K2YOU',
              event: 'k3y',
            },
          ],
        }),
        roster,
      ).awards.C,
    ).toBeDefined()
  })
  it('allows nonmember K3Y chasers without converting those contacts into membership credits', () => {
    const result = evaluateQso(
      qso(
        { startAtMillis: Date.parse('2026-01-05T12:00:00Z'), their: { call: 'K3Y/1' } },
        { event: 'k3y' },
        { number: 'NONE', qualified: false, key: 'OTHER' },
      ),
      roster,
    )
    expect(result.awards.K3Y).toBeDefined()
    expect(result.awards.C).toBeUndefined()
  })
  it('recognizes event editions saved by the activity hook and preserves cleared event evidence', async () => {
    const activity = createActivity(() => roster)
    const saved = async (event: string, at: string, changes: Qson = {}) => {
      const contact = qso({
        startAtMillis: Date.parse(at),
        refs: [{ type: 'skcc', number: '23456S', name: 'You', qualified: true, ...changes }],
        their: { call: event.startsWith('k3y') ? 'K3Y/1' : 'K2YOU' },
      })
      const patch = await activity.processQsoBeforeSave?.(
        { qso: contact, operation: { refs: [{ type: 'skcc', ref: event }] } },
        { online: false },
      )
      return {
        ...contact,
        their: { ...object(contact.their), ...object(patch?.their) },
        our: { ...object(contact.our), ...object(patch?.our) },
      }
    }
    const k3y = await saved('k3y:2026', '2026-01-05T12:00:00Z')
    expect(object(object(k3y.their).skcc).event).toBe('k3y:2026')
    expect(evaluateQso(k3y, roster).awards.K3Y?.ref).toBe('2026:1')
    const cskm = await saved('cskm:2026', '2026-09-20T12:00:00Z', {
      name: 'You/CSKM',
      spc: 'ON',
    })
    expect(evaluateQso(cskm, roster).awards.CSKM?.ref).toBe('2026:ON')
    const clear = await saved('k3y:2026', '2026-01-05T12:00:00Z', { event: '' })
    expect(evaluateQso(clear, roster).awards.K3Y).toBeUndefined()
    const wrongEdition = await saved('k3y:2027', '2026-01-05T12:00:00Z')
    expect(evaluateQso(wrongEdition, roster).awards.K3Y).toBeUndefined()
    expect(evaluateQso(k3y, roster, { band: '20m' }).awards.K3Y).toBeUndefined()
    expect(evaluateQso(k3y, roster, { myNumber: '999' }).awards.K3Y).toBeUndefined()
    const historicSprint = await saved('wes:2025-10', '2025-10-20T12:00:00Z')
    expect(evaluateQso(historicSprint, roster, { month: '2025-10' }).reasons.BRAG?.[0]).toContain(
      'During WES',
    )
    const historicGeneral = await saved('general', '2025-10-20T12:00:00Z')
    expect(evaluateQso(historicGeneral, roster, { month: '2025-10' }).awards.BRAG).toBeDefined()
    const historicUnknown = await saved('', '2025-10-20T12:00:00Z', { event: '' })
    expect(evaluateQso(historicUnknown, roster, { month: '2025-10' }).reasons.BRAG?.[0]).toContain(
      'Historical sprint schedule unknown',
    )
  })
  it('rejects deleted contacts, event markers, wrong modes, self contacts and invalid dates', () => {
    const cases: Qson[] = [
      { deleted: true },
      { band: 'event' },
      { mode: 'SSB' },
      { startAtMillis: NaN },
      { startAtMillis: 1e30 },
    ]
    for (const changes of cases) expect(evaluateQso(qso(changes), roster).awards.C).toBeUndefined()
    expect(evaluateQso(qso({}, { number: '1', name: 'Me' }), roster).awards.C).toBeUndefined()
    expect(evaluateQso(qso({}, { qualified: false, key: 'SK' }), roster).awards.C).toBeUndefined()
    expect(evaluateQso(qso({}, { qualified: 'no', key: 'SK' }), roster).awards.C).toBeUndefined()
    for (const key of ['OTHER', 'CPU', 'SP', 'DP', 'FAB'])
      expect(evaluateQso(qso({}, { qualified: true, key }), roster).awards.C).toBeUndefined()
    expect(evaluateQso(qso({}, { qualified: true, key: 'WAIVER' }), roster).awards.C).toBeDefined()
  })
})

describe('SKCC report award selection', () => {
  it('selects the highest member number for each licensed PFX and supports call changes', () => {
    const other = { ...them, number: '30000', call: 'K2NEW', oldCalls: [] }
    const result = analyzeAwards(
      [
        qso(),
        qso({ uuid: 'new', their: { call: 'K2NEW' } }, { number: '30000' }),
        qso({
          uuid: 'old',
          startAtMillis: Date.parse('2026-10-21T12:00:00Z'),
          their: { call: 'N3OLD/P' },
        }),
      ],
      { ...roster, members: [...roster.members, other] },
    )
    expect(result.awards.PFX.total).toBe(53456)
    expect(result.awards.PFX.credits.map((row) => row.ref)).toEqual(['K2', 'N3'])
    expect(result.awards.PFX.target).toBe(500001)
  })
  it('deduplicates QRP per member and band, requires positive power and applies the 60m date', () => {
    const repeats = [
      qso(),
      qso({ uuid: 'later', startAtMillis: Date.parse('2026-10-21T12:00:00Z') }),
      qso({ uuid: '20', band: '20m' }),
    ]
    expect(analyzeAwards(repeats, roster).awards.QRP1.total).toBe(3)
    expect(analyzeAwards(repeats, roster).awards.QRP2.total).toBe(3)
    expect(evaluateQso(qso({}, {}, { power: 0 }), roster).awards.QRP1).toBeUndefined()
    expect(
      evaluateQso(qso({ band: '60m', startAtMillis: Date.parse('2013-08-31T12:00:00Z') }), roster)
        .awards.QRP1,
    ).toBeUndefined()
  })
  it('keeps durations from duplicated imports out of Rag Chew and Marathon', () => {
    const result = analyzeAwards([qso(), qso({ uuid: 'copy' })], roster)
    expect(result.awards.RC.total).toBe(60)
    expect(result.awards.MARATHON.total).toBe(1)
    expect(result.awards.MARATHON.ready).toBe(false)
    const group = qso({ endAtMillis: Date.parse('2026-10-20T12:35:00Z') }, { participants: 3 })
    expect(evaluateQso(group, roster).awards.RC).toBeUndefined()
  })
  it('assigns Triple Key members disjointly across key types using a maximum matching', () => {
    const members = Array.from({ length: 300 }, (_, index) => ({
      ...them,
      number: String(1000 + index),
      call: `K1X${index}A`,
      oldCalls: [],
    }))
    const contacts = members.flatMap((member, index) => {
      const base = {
        uuid: `${index}:sk`,
        their: { call: member.call },
        startAtMillis: Date.parse('2026-10-20T12:00:00Z') + index * 120000,
      }
      const first = qso(base, { number: member.number }, { key: index < 200 ? 'SK' : 'SS' })
      return index < 100
        ? [
            first,
            qso(
              { ...base, uuid: `${index}:bug`, band: '20m' },
              { number: member.number },
              { key: 'BUG' },
            ),
          ]
        : [first]
    })
    const result = analyzeAwards(contacts, { ...roster, members: [me, ...members] })
    expect(result.awards.TKA.total).toBe(300)
    expect(new Set(result.awards.TKA.credits.map((row) => row.number)).size).toBe(300)
    for (const key of ['SK', 'BUG', 'SS'])
      expect(result.awards.TKA.credits.filter((row) => row.key === key)).toHaveLength(100)
  })
  it('requires the key declaration for Triple Key and never mixes operators', () => {
    expect(evaluateQso(qso({}, {}, { keyDeclared: false }), roster).awards.TKA).toBeUndefined()
    const reverse = qso(
      {
        uuid: 'reverse',
        our: { call: 'K2YOU', skcc: { number: '23456', name: 'You', key: 'SK' } },
        their: { call: 'N1ME' },
      },
      { number: '1', name: 'Me' },
    )
    const result = analyzeAwards([qso(), reverse], roster)
    expect(result.awards.C.total).toBe(0)
    expect(result.awards.C.excluded[0]?.reasons[0]).toContain('Multiple operators')
    expect(analyzeAwards([qso(), reverse], roster, { myNumber: '1' }).awards.C.total).toBe(1)
  })
  it('calculates Monthly Brag once per member and exposes the announced bonus separately', () => {
    const report = analyzeAwards([qso(), qso({ uuid: 'repeat', band: '20m' })], roster, {
      month: '2026-10',
      bragBonusNumber: '23456',
    })
    expect(report.awards.BRAG.total).toBe(1)
    expect(report.awards.BRAG.bonusPoints).toBe(25)
    const sprint = qso({ startAtMillis: Date.parse('2026-10-28T00:30:00Z') })
    expect(sprintAt(Number(sprint.startAtMillis))).toContain('sks')
    expect(analyzeAwards([sprint], roster, { month: '2026-10' }).awards.BRAG.total).toBe(0)
    const after = qso({ startAtMillis: Date.parse('2026-10-28T02:00:00Z') })
    expect(analyzeAwards([after], roster, { month: '2026-10' }).awards.BRAG.total).toBe(1)
  })
  it('does not mix WAC operating continents or special-event years', () => {
    const report = analyzeAwards(
      [
        qso(),
        qso({
          uuid: 'another',
          band: '20m',
          our: { call: 'N1ME', continent: 'EU', skcc: { number: '1', name: 'Me', key: 'SK' } },
          their: { call: 'K2YOU', continent: 'AF' },
        }),
      ],
      roster,
    )
    expect(report.awards.WAC.total).toBe(1)
  })
  it('requires a received CSKM suffix instead of inferring participation from Canadian location', () => {
    const contact = { startAtMillis: Date.parse('2026-09-20T12:00:00Z') }
    expect(
      evaluateQso(qso(contact, { event: 'cskm', spc: 'ON' }), roster).awards.CSKM,
    ).toBeUndefined()
    expect(
      evaluateQso(qso(contact, { event: 'cskm', spc: 'ON', name: 'You/CSKM' }), roster).awards.CSKM
        ?.ref,
    ).toBe('2026:ON')
  })
  it('explains prospect value without claiming to know the other member log', () => {
    const result = makeProspect(them, me, analyzeAwards([], roster, { scope: 'complete-history' }))
    expect(result.join(' ')).toContain('not in imported history')
    expect(result.join(' ')).toContain('their log is unknown')
  })
  it('uses all eligible rows for band prospects, beyond the aggregate application selection', () => {
    const report = analyzeAwards([qso(), qso({ uuid: 'another-band', band: '20m' })], roster)
    expect(report.awards.C.credits).toHaveLength(1)
    expect(makeProspect(them, me, report, '20m').join(' ')).not.toContain('Centurion on 20m:')
    expect(makeProspect(them, me, report, '10m').join(' ')).toContain('Centurion on 10m:')
  })
})
