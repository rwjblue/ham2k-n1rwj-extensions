import type {
  PanelContent,
  PanelEnvironment,
  PanelRenderArgs,
  PanelScene,
} from '@ham2k/extension-sdk'
import { describe, expect, it, vi } from 'vitest'
import { buildZombieExperience } from '../src/experience.ts'
import { type Qson, refOf } from '../src/model.ts'
import { createZombiePanel, zombieBookMarkdown, zombieWatchMarkdown } from '../src/panel.ts'

const START = Date.UTC(2026, 9, 30, 19)
const END = START + 9 * 60 * 60_000

it('declines unsupported event editions before reading the log', async () => {
  const getQsos = vi.fn(async () => [])
  const content = await createZombiePanel().render(
    args({ operation: { ...operation, refs: [{ type: 'zombie', ref: '2027' }] } }),
    { online: false, getQsos },
  )
  expect(content.kind).toBe('markdown')
  if (content.kind !== 'markdown') throw new Error('Expected guidance')
  expect(content.content).toContain('no confirmed rules')
  expect(getQsos).not.toHaveBeenCalled()
})
const operation: Qson = {
  uuid: 'graveyard-operation',
  stationCall: 'N1RWJ',
  refs: [
    {
      type: 'zombie',
      ref: '2026',
      utcOffset: '-04:00',
      ourSpc: 'RI',
      ourZombieNumber: '002',
      ourZombieName: 'OLD NICK',
    },
  ],
}
function contact(uuid = 'first', minutes = 0, overrides: Qson = {}): Qson {
  return {
    uuid,
    startAtMillis: START + minutes * 60_000,
    band: '40m',
    mode: 'CW',
    their: { call: 'K1ABC', sent: '599' },
    refs: [{ type: 'zombie', theirSpc: 'MA', theirZombieNumber: '0002', theirZombieName: 'IGOR' }],
    ...overrides,
  }
}
function environment(reducedMotion = false): PanelEnvironment {
  const type = {
    fontFamily: 'Roboto',
    fontFamilyFallback: [],
    fontSize: 14,
    scaledFontSize: 14,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
  }
  return {
    version: 1,
    width: 560,
    height: 660,
    safeInsets: { top: 0, bottom: 0, left: 0, right: 0 },
    brightness: 'dark',
    colors: {
      surface: '#211A35',
      surfaceContainer: '#30273E',
      onSurface: '#F6EAD3',
      onSurfaceVariant: '#C6B8D8',
      accent: '#F2C46D',
      primary: '#F2C46D',
      onPrimary: '#211A35',
      secondary: '#B9D98D',
      outline: '#605075',
      outlineVariant: '#665279',
      error: '#FFB4AB',
      onError: '#690005',
    },
    typography: { body: type, label: type, title: type, display: type, mono: type },
    locale: 'en',
    textDirection: 'ltr',
    devicePixelRatio: 1,
    reducedMotion,
    highContrast: false,
  }
}
function args(overrides: Partial<PanelRenderArgs> = {}): PanelRenderArgs {
  return {
    instanceId: 'graveyard-placement',
    panelKey: 'graveyard',
    operation,
    config: {},
    qsoCount: 0,
    reason: 'initial',
    environment: environment(),
    clock: { nowMillis: START, realNowMillis: 10_000 },
    ...overrides,
  }
}
function at(
  nowMillis: number,
  realNowMillis: number,
  overrides: Partial<PanelRenderArgs> = {},
): PanelRenderArgs {
  return args({ clock: { nowMillis, realNowMillis }, ...overrides })
}
function scene(result: PanelContent): PanelScene {
  if (result.kind !== 'svgScene' && result.kind !== 'scene')
    throw new Error(`Expected a scene, got ${result.kind}`)
  return result.scene
}
function text(result: PanelContent): string {
  return scene(result)
    .layers.map((layer) => layer.text?.literal ?? '')
    .join(' ')
}
function markdown(result: PanelContent): string {
  if (result.kind !== 'markdown') throw new Error(`Expected Markdown, got ${result.kind}`)
  return result.content
}

describe('Zombie graveyard panel', () => {
  it('offers scene, detailed watch and book views using operation/log refreshes without per-key triggers', async () => {
    const panel = createZombiePanel()
    const descriptors = await panel.getPanels({}, { online: false })
    expect(descriptors).toHaveLength(1)
    expect(descriptors[0]).toMatchObject({ key: 'graveyard', on: ['operation', 'qsoLogged'] })
    expect(descriptors[0]?.preview).toMatch(/^<svg /)
    expect(descriptors[0]?.form).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'view',
          value: 'scene',
          options: [
            { value: 'scene', label: 'Graveyard scene' },
            { value: 'watch', label: 'Detailed rebirth watch' },
            { value: 'book', label: 'Book of the Undead' },
          ],
        }),
        expect.objectContaining({ key: 'motion', value: true }),
      ]),
    )
  })

  it('uses the native scene on current hosts and readable Markdown on older hosts or configured alternate views', async () => {
    const panel = createZombiePanel()
    const getQsos = vi.fn(async () => [contact()])
    const ctx = { online: false, getQsos }
    const native = await panel.render(args(), ctx)
    expect(native.kind).toBe('svgScene')
    expect(native.title).toContain('1 QSOs')
    expect(scene(native).values.shuffle).toBe(0)
    expect(text(native)).toContain('IGOR')
    const legacy = await panel.render(args({ environment: undefined }), ctx)
    expect(markdown(legacy)).toContain('Rebirth watch')
    expect(markdown(legacy)).toContain('IGOR · K1ABC')
    const watch = await panel.render(args({ config: { view: 'watch' } }), ctx)
    expect(markdown(watch)).toContain('| Zombie | Band | Eligible again |')
    const book = await panel.render(args({ config: { view: 'book' } }), ctx)
    expect(markdown(book)).toContain('Book of the Undead')
    expect(markdown(book)).toContain('**#0002**')
    expect(book.triggers).toEqual([])
  })

  it('expires new-contact celebrations in four seconds and never rereads the log on animation ticks', async () => {
    const panel = createZombiePanel()
    let rows: Qson[] = []
    const getQsos = vi.fn(async () => rows)
    const ctx = { online: false, getQsos }
    await panel.render(args(), ctx)
    rows = [contact()]
    const found = await panel.render(at(START, 11_000, { reason: 'qsoLogged', qsoCount: 1 }), ctx)
    expect(scene(found).values.shuffle).toBe(1)
    expect(text(found)).toContain('Another soul on the air!')
    expect(found.triggers).toEqual(['tick:1'])
    const down = await panel.render(at(START, 12_000, { reason: 'tick' }), ctx)
    expect(scene(down).values.shuffle).toBe(0)
    const up = await panel.render(at(START, 13_000, { reason: 'tick' }), ctx)
    expect(scene(up).values.shuffle).toBe(1)
    const expired = await panel.render(at(START, 15_000, { reason: 'tick' }), ctx)
    expect(scene(expired).values.shuffle).toBe(0)
    expect(text(expired)).not.toContain('Another soul on the air!')
    expect(expired.triggers).toEqual(['tick:60'])
    expect(getQsos).toHaveBeenCalledTimes(2)
  })

  it('turns a minute watch tick ready at the exact boundary without another full-log read', async () => {
    const panel = createZombiePanel()
    const getQsos = vi.fn(async () => [contact()])
    const ctx = { online: false, getQsos }
    const resting = await panel.render(
      at(START + 119 * 60_000, 10_000, { config: { view: 'watch' } }),
      ctx,
    )
    expect(markdown(resting)).toContain('Rises in 1 min')
    expect(resting.triggers).toEqual(['tick:60'])
    const ready = await panel.render(
      at(START + 120 * 60_000, 70_000, { reason: 'tick', config: { view: 'watch' } }),
      ctx,
    )
    expect(markdown(ready)).toContain('ELIGIBLE NOW')
    expect(getQsos).toHaveBeenCalledExactlyOnceWith('graveyard-operation')
  })

  it('refreshes the event countdown through start and end using cached log state', async () => {
    const panel = createZombiePanel()
    const getQsos = vi.fn(async () => [])
    const ctx = { online: false, getQsos }
    const before = await panel.render(at(START - 60_000, 10_000), ctx)
    expect(text(before)).toContain('Starts in 1m')
    expect(before.triggers).toEqual(['tick:60'])
    const started = await panel.render(at(START, 70_000, { reason: 'tick' }), ctx)
    expect(text(started)).toContain('Ends in 9h 0m')
    const ending = await panel.render(at(END - 60_000, 80_000, { reason: 'tick' }), ctx)
    expect(text(ending)).toContain('Ends in 1m')
    const ended = await panel.render(at(END, 90_000, { reason: 'tick' }), ctx)
    expect(text(ended)).toContain('The shuffle has ended')
    expect(ended.triggers).toEqual([])
    expect(getQsos).toHaveBeenCalledExactlyOnceWith('graveyard-operation')
  })

  it('keeps system and configured reduced-motion scenes static while watch clocks remain available', async () => {
    for (const overrides of [{ environment: environment(true) }, { config: { motion: false } }]) {
      const panel = createZombiePanel()
      let rows: Qson[] = []
      const ctx = { online: false, getQsos: async () => rows }
      await panel.render(args(overrides), ctx)
      rows = [contact()]
      const found = await panel.render(
        at(START, 11_000, { ...overrides, reason: 'qsoLogged' }),
        ctx,
      )
      expect(scene(found).values.shuffle).toBe(0)
      expect(text(found)).toContain('Another soul on the air!')
      expect(
        scene(found)
          .layers.filter((layer) => layer.transitionMs !== undefined)
          .every((layer) => layer.transitionMs === 0),
      ).toBe(true)
    }
  })

  it('rereads same-count edits and clearing, removing both obsolete identities and active feedback', async () => {
    const panel = createZombiePanel()
    let rows: Qson[] = []
    const getQsos = vi.fn(async () => rows)
    const ctx = { online: false, getQsos }
    await panel.render(args(), ctx)
    rows = [contact()]
    await panel.render(at(START, 11_000, { reason: 'qsoLogged', qsoCount: 1 }), ctx)
    rows = [
      contact('first', 0, {
        refs: [{ type: 'zombie', theirSpc: 'CT', theirZombieNumber: '2', theirZombieName: '' }],
      }),
    ]
    const invalid = await panel.render(
      at(START, 11_100, { reason: 'operation', qsoCount: 1, config: { view: 'book' } }),
      ctx,
    )
    expect(markdown(invalid)).toContain('0 qualifying QSOs')
    expect(markdown(invalid)).not.toContain('### IGOR')
    rows = []
    const cleared = await panel.render(at(START, 11_200, { reason: 'operation' }), ctx)
    expect(text(cleared)).not.toContain('Another soul on the air!')
    expect(text(cleared)).not.toContain('IGOR')
    expect(text(cleared)).toContain('Log a qualifying QSO')
    expect(getQsos).toHaveBeenCalledTimes(4)
  })

  it('uses independent placement and operation baselines and quietly reopens an existing graveyard', async () => {
    const panel = createZombiePanel()
    let rows: Qson[] = []
    const ctx = { online: false, getQsos: async () => rows }
    await panel.render(args(), ctx)
    rows = [contact()]
    expect(
      scene(await panel.render(at(START, 11_000, { reason: 'qsoLogged' }), ctx)).values.shuffle,
    ).toBe(1)
    expect(
      scene(await panel.render(at(START, 11_100, { instanceId: 'other-placement' }), ctx)).values
        .shuffle,
    ).toBe(0)
    const otherOperation = { ...operation, uuid: 'other-operation' }
    expect(
      scene(await panel.render(at(START, 11_200, { operation: otherOperation }), ctx)).values
        .shuffle,
    ).toBe(0)
    expect(
      scene(await panel.render(at(START, 11_300, { reason: 'operation' }), ctx)).values.shuffle,
    ).toBe(0)
  })

  it('offers setup guidance, a quiet empty graveyard, and an ended view without advertising a rebirth', async () => {
    const panel = createZombiePanel()
    const ctx = { online: false, getQsos: async () => [] }
    const missing = { ...operation, refs: [{ ...refOf(operation), utcOffset: '' }] }
    const setup = await panel.render(args({ operation: missing, config: { view: 'watch' } }), ctx)
    expect(markdown(setup)).toContain('Set the event-day UTC offset')
    const empty = await panel.render(args({ config: { view: 'book' } }), ctx)
    expect(markdown(empty)).toContain('The pages are quiet')
    const ended = await panel.render(at(END, 10_000, { config: { view: 'watch' } }), {
      online: false,
      getQsos: async () => [contact()],
    })
    expect(markdown(ended)).toContain('The shuffle has ended')
    expect(markdown(ended)).not.toContain('ELIGIBLE NOW')
    expect(ended.triggers).toEqual([])
  })

  it('distinguishes unavailable and failed log reads from empty progress and never reads an unrelated operation', async () => {
    const panel = createZombiePanel()
    const getQsos = vi.fn(async () => [contact()])
    expect(
      markdown(
        await panel.render(args({ operation: { uuid: 'other', refs: [] } }), {
          online: false,
          getQsos,
        }),
      ),
    ).toContain('Add **Zombie Shuffle 2026**')
    expect(getQsos).not.toHaveBeenCalled()
    expect(markdown(await panel.render(args(), { online: false }))).toContain(
      'operation log is unavailable',
    )
    expect(
      markdown(
        await panel.render(args({ operation: { refs: operation.refs } }), {
          online: false,
          getQsos,
        }),
      ),
    ).toContain('operation log is unavailable')
    for (const read of [
      async () => null,
      async () => {
        throw new Error('Cannot read')
      },
    ]) {
      const result = await panel.render(args(), { online: false, getQsos: read })
      expect(markdown(result)).toContain('operation log could not be read')
      expect(result.triggers).toEqual([])
    }
  })

  it('does not resurrect cached credit on a queued tick after an authoritative read fails', async () => {
    const panel = createZombiePanel()
    let rows: Qson[] | null = [contact()]
    const ctx = { online: false, getQsos: async () => rows }
    expect((await panel.render(args(), ctx)).kind).toBe('svgScene')
    rows = null
    const failed = await panel.render(at(START, 11_000, { reason: 'operation' }), ctx)
    expect(markdown(failed)).toContain('operation log could not be read')
    const queuedTick = await panel.render(at(START + 120 * 60_000, 12_000, { reason: 'tick' }), ctx)
    expect(markdown(queuedTick)).toContain('operation log could not be read')
  })

  it('fails closed for live segment overrides instead of presenting a score based only on the base operation', async () => {
    const panel = createZombiePanel()
    const marker: Qson = {
      uuid: 'break',
      band: 'event',
      startAtMillis: START + 30 * 60_000,
      event: { event: 'break', operation: { refs: [] } },
    }
    const result = await panel.render(args(), {
      online: false,
      getQsos: async () => [contact(), marker],
    })
    expect(markdown(result)).toMatch(/segment|timeline/i)
    expect(result.triggers).toEqual([])
  })

  it('keeps a segmented log blocked on pending ticks after replacing an earlier unsegmented snapshot', async () => {
    const panel = createZombiePanel()
    let rows: Qson[] = [contact()]
    const ctx = { online: false, getQsos: async () => rows }
    expect((await panel.render(args(), ctx)).kind).toBe('svgScene')
    rows = [
      ...rows,
      {
        uuid: 'break',
        band: 'event',
        startAtMillis: START + 30 * 60_000,
        event: { event: 'break', operation: { refs: [] } },
      },
    ]
    const blocked = await panel.render(at(START, 11_000, { reason: 'operation' }), ctx)
    expect(markdown(blocked)).toMatch(/segment|timeline/i)
    const queuedTick = await panel.render(at(START + 120 * 60_000, 12_000, { reason: 'tick' }), ctx)
    expect(markdown(queuedTick)).toMatch(/segment|timeline/i)
  })

  it('keeps a CQ BOO greeting through the authoritative event render and rejects unsupported actions', async () => {
    const panel = createZombiePanel()
    const ctx = { online: false, getQsos: async () => [] }
    const event = { controlId: 'greet', action: 'greet', phase: 'activate' as const, sequence: 1 }
    await expect(panel.onEvent?.({ ...args(), event }, ctx)).rejects.toThrow(
      'Open the Zombie graveyard',
    )
    await panel.render(args(), ctx)
    const patch = await panel.onEvent?.({ ...at(START, 11_000), event }, ctx)
    expect(patch?.values.shuffle).toBe(1)
    const greeting = await panel.render(at(START, 11_100, { reason: 'event' }), ctx)
    expect(text(greeting)).toContain('CQ BOO! Your zombie waves hello.')
    await expect(
      panel.onEvent?.({ ...args(), event: { ...event, action: 'unknown' } }, ctx),
    ).rejects.toThrow()
  })
})

describe('Zombie watch and Book formatting', () => {
  it('escapes copied Markdown and HTML without losing full names, locations or leading zeros', () => {
    const row = contact('unsafe', 0, {
      refs: [
        {
          type: 'zombie',
          theirSpc: 'NZ | [link](x)',
          theirZombieNumber: '0002',
          theirZombieName: '*Igor* <script> &ast; `boo`',
        },
      ],
    })
    const model = buildZombieExperience(operation, [row], START)
    const book = zombieBookMarkdown(model)
    expect(book).toContain('\\*Igor\\* &lt;script&gt; &amp;ast; \\`boo\\`')
    expect(book).toContain('NZ \\| \\[LINK\\]\\(X\\)')
    expect(book).toContain('**#0002**')
    expect(book).not.toContain('<script>')
    expect(book).not.toContain('[link](x)')
    const watch = zombieWatchMarkdown(model, START)
    expect(watch).toContain('\\*Igor\\* &lt;script&gt;')
    expect(watch).toContain('Eligible again does not mean currently on air')
  })

  it('shows the 60 most recent copied visitors while keeping the authoritative total', () => {
    const rows = Array.from({ length: 61 }, (_, index) =>
      contact(`qso-${index}`, index, { their: { call: `K${index}ABC`, sent: '599' } }),
    )
    const markdown = zombieBookMarkdown(
      buildZombieExperience(operation, rows, START + 120 * 60_000),
    )
    expect(markdown).toContain('61 distinct callsigns · 61 qualifying QSOs')
    expect(markdown.match(/^### /gm)).toHaveLength(60)
    expect(markdown).toContain('Showing the 60 most recent visitors')
    expect(markdown).toContain('K60ABC')
    expect(markdown).not.toContain('· K0ABC\n')
  })
})
