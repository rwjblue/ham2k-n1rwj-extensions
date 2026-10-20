import { createHash } from 'node:crypto'
import type { FormDefinition, FormLinkElement } from '@ham2k/extension-sdk'
import { describe, expect, it } from 'vitest'
import { ZOMBIE_GUIDE_URL, zombieAboutDefinition, zombieAboutPanel } from '../src/about.ts'
import { zombieAboutArtwork, zombieAboutArtworkSourceHash } from '../src/about-art.ts'
import { RULES_URL } from '../src/model.ts'
import { zombiePanelPreview } from '../src/panel-preview.ts'

function markdown(form: FormDefinition): string {
  return form.elements
    .filter((element) => element.type === 'markdown')
    .map((element) => element.text)
    .filter((text) => !text.startsWith('!['))
    .join('\n')
}

function links(form: FormDefinition): FormLinkElement[] {
  return form.elements.filter((element) => element.type === 'link')
}

describe('Zombie Shuffle about page', () => {
  it('embeds a modest offline PNG of the current original picker art in native Markdown syntax', () => {
    expect(zombieAboutArtwork).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/)
    const png = Buffer.from(zombieAboutArtwork.split(',')[1] ?? '', 'base64')
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.readUInt32BE(16)).toBe(320)
    expect(png.readUInt32BE(20)).toBe(320)
    expect(png.length).toBeLessThan(30_000)
    expect(zombieAboutArtworkSourceHash).toBe(
      createHash('sha256').update(zombiePanelPreview).digest('hex'),
    )
    expect(zombieAboutDefinition().elements[0]).toEqual({
      type: 'markdown',
      text: `![A friendly headphone-wearing Zombie waves beside a moonlit radio shack.](${zombieAboutArtwork}#320x320)`,
    })
  })

  it('uses a namespaced native settings descriptor without adding a Data Files row', () => {
    expect(zombieAboutPanel()).toEqual({
      key: 'n1rwj-zombie_about',
      title: 'Zombie Shuffle · About',
      icon: 'ghost',
      dataFilesSection: false,
    })
    expect(zombieAboutPanel({ key: 'another-zombie', icon: 'pumpkin' })).toMatchObject({
      key: 'another-zombie_about',
      icon: 'pumpkin',
    })
  })

  it('links the organizer, operator guide and current official summary sheets through native links', () => {
    expect(links(zombieAboutDefinition())).toEqual([
      expect.objectContaining({ key: 'officialRules', url: RULES_URL }),
      expect.objectContaining({ key: 'operatorGuide', url: ZOMBIE_GUIDE_URL }),
      expect.objectContaining({
        key: 'summaryXls',
        url: 'https://www.zianet.com/qrp/ZOMBIE/summary_sheet_2026.xls',
      }),
      expect.objectContaining({
        key: 'summaryOds',
        url: 'https://www.zianet.com/qrp/ZOMBIE/summary_sheet_2026.ods',
      }),
    ])
    expect(links(zombieAboutDefinition()).every((link) => link.url.startsWith('https://'))).toBe(
      true,
    )
  })

  it('states local 2026 CW/QRP rules without carrying forward the organizer’s stale deadline', () => {
    const text = markdown(zombieAboutDefinition())
    expect(text).toContain('Friday, October 30, 2026 · 15:00–midnight local time')
    expect(text).toContain('CW at 5 W or less')
    expect(text).toContain('UTC offset on the event date')
    expect(text).toContain('Only designated 2026 bonus stations send **4321**')
    expect(text).not.toMatch(/November|2025|3333|UTC\s*15:00|roster/i)
  })

  it('distinguishes lifetime identity, history hints and rebirth on each actual band', () => {
    const text = markdown(zombieAboutDefinition())
    expect(text).toContain('Assigned Zombie numbers last for life')
    expect(text).toContain('same band after two elapsed hours')
    expect(text).toContain('each band keeps its own rebirth clock')
    expect(text).toContain('does not confirm who is on the air')
    expect(text).toContain('Copy and confirm the exchange you hear')
  })

  it('is a static, read-only definition with independent results for each opening', () => {
    const first = zombieAboutDefinition()
    expect(first.elements.every((element) => !['field', 'action'].includes(element.type))).toBe(
      true,
    )
    first.elements.length = 0
    expect(zombieAboutDefinition().elements.length).toBeGreaterThan(0)
  })
})
