import { describe, expect, it } from 'vitest'
import { zombiePanelPreview } from '../src/panel-preview.ts'

describe('Zombie picker illustration', () => {
  it('is a complete square, offline, font-free SVG without operation status', () => {
    expect(zombiePanelPreview).toMatch(
      /^<svg\b[^>]*width="640"[^>]*height="640"[^>]*viewBox="0 0 640 640"/,
    )
    expect(zombiePanelPreview.trim()).toMatch(/<\/svg>$/)
    expect(zombiePanelPreview).toContain('Zombie Shuffle midnight radio club')
    expect(zombiePanelPreview).not.toMatch(
      /<(?:text|script|image|foreignObject|animate)\b|font-family|@font-face|href=/i,
    )
    expect(zombiePanelPreview).not.toMatch(/QSOs|ELIGIBLE|RESTING|earned|4321|K1ABC|N1RWJ/)
    expect(zombiePanelPreview).not.toContain('undefined')
    expect(zombiePanelPreview).not.toContain('NaN')
  })

  it('keeps every reused artwork definition isolated and every local paint reference resolvable', () => {
    const ids = [...zombiePanelPreview.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
    expect(ids.length).toBeGreaterThan(10)
    expect(new Set(ids).size).toBe(ids.length)
    const references = [...zombiePanelPreview.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1])
    for (const reference of references) expect(ids).toContain(reference)
    expect(ids.every((id) => id.startsWith('zombie-picker-'))).toBe(true)
    expect(zombiePanelPreview).toContain('zombie-picker-body-zombie-skin')
    expect(zombiePanelPreview).toContain('zombie-picker-left-arm-zombie-left-arm-skin')
    expect(zombiePanelPreview).toContain('zombie-picker-right-arm-zombie-right-arm-skin')
    expect(zombiePanelPreview).toContain('zombie-picker-lantern-zombie-lantern-glow')
  })
})
