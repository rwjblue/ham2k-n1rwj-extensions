// Copyright © 2026 Robert Jackson
// SPDX-License-Identifier: MPL-2.0
import type { FormDefinition } from '@ham2k/extension-sdk'
import { HOME } from './model.ts'

export function skccAboutDefinition(): FormDefinition {
  return {
    title: 'About SKCC Companion',
    elements: [
      {
        type: 'markdown',
        text: 'Recognize members, log the exchange, find friendly CW contacts and follow your SKCC goals. Suggestions remain editable. Only recorded exchanges and approved keying qualify for award reports.',
      },
      {
        type: 'markdown',
        text: 'Personal N1RWJ extension, not an official SKCC product. SKCCLogger and SKCC Skimmer remain useful companions. Award thresholds mean ready for review, not sponsor approval. SKS is unassisted: close native spots, chasing, RBN and sked assistance when operating it.',
      },
      { type: 'divider', title: 'History and award applications' },
      {
        type: 'markdown',
        text: 'The panel distinguishes this operation from a dated imported-history snapshot. Importing in preferences analyzes a copy; it does not insert contacts into the logger. Use the SKCC audit and application exports while this analysis is loaded. Native Chasing checklists use Ham2K’s own log.',
      },
      { type: 'divider', title: 'Offline membership data' },
      {
        type: 'markdown',
        text: 'Refresh or remove **SKCC member roster** in the host’s Data Files controls. Names, member lookup and award evaluation then work offline.',
      },
      { type: 'divider', title: 'Experimental native chasing' },
      {
        type: 'markdown',
        text: 'Native award checklists require a host with EXP CHASE enabled. After refreshing the membership roster, use **Reload the native chasing roster** in preferences, then turn EXP CHASE off and back on on a device holding the complete log. That asks the host to recalculate historical eligibility. A reload alone does not rebuild an unchanged program version. The companion reports always use the currently loaded roster.',
      },
      { type: 'link', label: 'SKCC home and award rules', url: HOME },
      {
        type: 'link',
        label: 'Monthly Brag and bonus member',
        url: `${HOME}operating_activities/monthly_brag/`,
      },
      { type: 'link', label: 'SKCC Sked Page', url: 'https://sked.skccgroup.com/' },
      { type: 'link', label: 'Manual-key policy', url: `${HOME}keypolicy.php` },
    ],
  }
}
