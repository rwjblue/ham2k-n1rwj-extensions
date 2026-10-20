import assert from 'node:assert/strict'
import { test } from 'vitest'
import { progressInfoMarkdown } from '../src/info.ts'
import { buildProgress, EVENT_2026, type Qson, qualifyingContacts } from '../src/rules.ts'

function qso(uuid: string, call: string, band = '20m', mode = 'CW'): Qson {
  return { uuid, their: { call }, band, mode, startAtMillis: Date.UTC(2026, 9, 20, 1) }
}

function info(qsos: Qson[]): string {
  return progressInfoMarkdown(buildProgress(qualifyingContacts(qsos, EVENT_2026)))
}

test('separates earned CW and Mixed O slots without granting credit to same-context repeats', () => {
  const text = info([qso('first', 'W7O'), qso('repeat', 'W7O'), qso('phone', 'W7O', '20m', 'USB')])
  assert.ok(text.includes('📻 **CW 1/7** · 🧩 **Mixed 2/7**'))
  assert.ok(text.includes('**O — W7O (first)** · CW: ✅ worked · Mixed: ✅ worked'))
  assert.ok(text.includes('**O — W7O (second)** · CW: 🔎 needed · Mixed: ✅ worked'))
  assert.ok(text.includes('**B — W7B** · CW: 🔎 needed · Mixed: 🔎 needed'))
  assert.ok(text.includes('📻 An all-CW pair needs another band or UTC date.'))
  assert.ok(!text.includes('complete!'))
})

test('celebrates Mixed completion independently from an unfinished CW hunt', () => {
  const qsos = ['W7B', 'W7I', 'W7G', 'W7F', 'W7O', 'W7O', 'W7T'].map((call, index) =>
    qso(`phone-${index}`, call, index === 5 ? '40m' : '20m', 'SSB'),
  )
  const text = info(qsos)
  assert.ok(text.includes('📻 **CW 0/7** · 🧩 **Mixed 7/7**'))
  assert.ok(text.includes('🎉🧩 **Mixed BIGFOOT complete!**'))
  assert.ok(!text.includes('CW BIGFOOT complete!'))
  assert.ok(text.includes('🎙️ Phone 7/7 · 💻 Digital 0/7'))
  assert.ok(text.includes('🦨 **Skunk Ape bonus (W4S)** · CW: 🔎 needed · Mixed: 🔎 needed'))
})

test('celebrates a CW sweep without requiring the separate bonus', () => {
  const qsos = ['W7B', 'W7I', 'W7G', 'W7F', 'W7O', 'W7O', 'W7T'].map((call, index) =>
    qso(`cw-${index}`, call, index === 5 ? '40m' : '20m'),
  )
  const text = info(qsos)
  assert.ok(text.includes('🎉🐾 **CW BIGFOOT complete!** 🏆'))
  assert.ok(text.includes('🎉🧩 **Mixed BIGFOOT complete!**'))
  assert.ok(text.includes('🦨 **Skunk Ape bonus (W4S)** · CW: 🔎 needed · Mixed: 🔎 needed'))
})

test('a lone bonus and its deletion cannot manufacture letter or completion credit', () => {
  const bonus = info([qso('bonus', 'W4S')])
  assert.ok(bonus.includes('📻 **CW 0/7** · 🧩 **Mixed 0/7**'))
  assert.ok(bonus.includes('🦨 **Skunk Ape bonus (W4S)** · CW: ✅ worked · Mixed: ✅ worked'))
  assert.ok(!bonus.includes('complete!'))
  const deleted = info([{ ...qso('bonus', 'W4S'), deleted: true }])
  assert.ok(deleted.includes('🦨 **Skunk Ape bonus (W4S)** · CW: 🔎 needed · Mixed: 🔎 needed'))
  assert.ok(!deleted.includes('✅ worked'))
  assert.ok(!deleted.includes('complete!'))
})
