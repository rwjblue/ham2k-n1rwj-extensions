import type { buildProgress, Contact } from './rules.ts'
import type { Target } from './targets.ts'

/** Stable station facts only: the host caches lookup notes while composing. */
export function targetInfoNotes(target: Target): string[] {
  const identity = target.bonus
    ? '🦨 **Skunk Ape — W4S** · A separate bonus alongside the seven BIGFOOT letters.'
    : target.call === 'W7O'
      ? '⭕ **O + O — W7O** · Two qualifying contacts fill the two O slots.'
      : `🔤 **${target.letter} — ${target.call}** · One letter in **B I G F O O T**.`
  return [
    '🌲🐾 **BIGFOOT Hunt 2026** 🐾🌲',
    identity,
    ...(target.call === 'W7O'
      ? [
          '🔁 **Second O:** the second W7O must use a different band, mode, or UTC date.',
          '📻 **All-CW hunt:** use another band or UTC date.',
        ]
      : []),
    '🗓️ **October 13–21, 2026 UTC**',
  ]
}

function status(contact: Contact | undefined): string {
  return contact ? '✅ worked' : '🔎 needed'
}

/** Current earned progress, supplied through scoring rather than cached notes. */
export function progressInfoMarkdown(progress: ReturnType<typeof buildProgress>): string {
  const { CW: cw, MIXED: mixed, PHONE: phone, DIGITAL: digital } = progress
  const checklist = cw.slots.map((slot, index) => {
    const name = slot.call === 'W7O' ? `W7O (${index === 4 ? 'first' : 'second'})` : slot.call
    return `- **${slot.letter} — ${name}** · CW: ${status(slot.contact)} · Mixed: ${status(mixed.slots[index]?.contact)}`
  })
  return [
    '🌲🐾 **B I G F O O T** 🐾🌲',
    `📻 **CW ${cw.worked}/7** · 🧩 **Mixed ${mixed.worked}/7**`,
    ...(cw.complete ? ['🎉🐾 **CW BIGFOOT complete!** 🏆'] : []),
    ...(mixed.complete ? ['🎉🧩 **Mixed BIGFOOT complete!**'] : []),
    '🔎 **Letter trail**',
    checklist.join('\n'),
    `🦨 **Skunk Ape bonus (W4S)** · CW: ${status(cw.bonus)} · Mixed: ${status(mixed.bonus)}`,
    `🎙️ Phone ${phone.worked}/7 · 💻 Digital ${digital.worked}/7`,
    '🔁 **Second O:** use a different band, actual mode, or UTC date. 📻 An all-CW pair needs another band or UTC date.',
  ].join('\n\n')
}
