// Copyright (c) 2026 Robert Jackson (N1RWJ)
// SPDX-License-Identifier: MPL-2.0
import type { FormDefinition } from '@ham2k/extension-sdk'
import { zombieAboutArtwork } from './about-art.ts'
import { BONUS_NUMBER, EVENT_REF, RULES_URL } from './model.ts'

export const ZOMBIE_GUIDE_URL =
  'https://github.com/rwjblue/ham2k-n1rwj-extensions/tree/main/extensions/contests/n1rwj-zombie#readme'

/** Static, offline event guidance; links open through the host's native rows.
 * The organizer's page is authoritative. It still lists a prior-year
 * submission deadline, so this page deliberately supplies no 2026 deadline. */
export function zombieAboutDefinition(): FormDefinition {
  return {
    title: 'Zombie Shuffle',
    subtitle: 'CQ BOO! There is always room for one more Zombie.',
    elements: [
      {
        type: 'markdown',
        text: `![A friendly headphone-wearing Zombie waves beside a moonlit radio shack.](${zombieAboutArtwork}#320x320)`,
      },
      {
        type: 'markdown',
        text: 'A relaxed Halloween gathering for CW operators at any speed. Choose a spooky or silly name, turn the power down, and enjoy a few friendly contacts. New and rusty fists are welcome: ask for a repeat or a slower speed whenever you need it.',
      },
      {
        type: 'link',
        key: 'officialRules',
        label: 'Official Zombie Shuffle page',
        url: RULES_URL,
        icon: 'web',
        description: 'Event rules, number requests, summary sheets and submission instructions.',
      },
      { type: 'divider', title: `${EVENT_REF} field guide` },
      {
        type: 'markdown',
        text: `**Friday, October 30, ${EVENT_REF} · 15:00–midnight local time.** HI, AK and DX may use other hours during the Shuffle. Operate **CW at 5 W or less** on 80, 40, 20, 15 or 10 meters.\n\nSend **RST · state/province/country · Zombie number · Zombie name**. Assigned Zombie numbers last for life; a three-digit telephone area code also works. Only designated ${EVENT_REF} bonus stations send **${BONUS_NUMBER}**.\n\nA station can rise again on the **same band after two elapsed hours**. Contact it sooner on another band. The 10 m and 15 m scores share a group, but each band keeps its own rebirth clock.`,
      },
      { type: 'divider', title: 'At the logging table' },
      {
        type: 'markdown',
        text: 'Add Zombie Shuffle 2026 to an operation and configure your number, spooky name, location and **UTC offset on the event date**, including daylight saving time. Enable flexible hours if operating from HI, AK or DX.\n\nThe graveyard keeps your visitors, score groups and rebirth watch together. Native Info shows scoring details and identity hints. Optional call history works offline after download; it suggests exchanges, and does not confirm who is on the air. Copy and confirm the exchange you hear.',
      },
      {
        type: 'link',
        key: 'operatorGuide',
        label: 'Extension operator guide',
        url: ZOMBIE_GUIDE_URL,
        icon: 'book-open-page-variant-outline',
        description: 'Setup, call history, scoring, exports and graveyard display guidance.',
      },
      { type: 'divider', title: 'After the Shuffle' },
      {
        type: 'markdown',
        text: 'The organizers request a summary rather than a full log. Use the extension’s summary export to help fill out the official sheet, then check the official page for current submission instructions.',
      },
      {
        type: 'link',
        key: 'summaryXls',
        label: `${EVENT_REF} official summary sheet · Excel`,
        url: `https://www.zianet.com/qrp/ZOMBIE/summary_sheet_${EVENT_REF}.xls`,
        icon: 'file-table-outline',
      },
      {
        type: 'link',
        key: 'summaryOds',
        label: `${EVENT_REF} official summary sheet · OpenDocument`,
        url: `https://www.zianet.com/qrp/ZOMBIE/summary_sheet_${EVENT_REF}.ods`,
        icon: 'file-table-outline',
      },
    ],
  }
}
