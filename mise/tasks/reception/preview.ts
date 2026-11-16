#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Render deterministic PSK Reporter and RBN info-pane mockups from the real scene code"
//[MISE] depends=["install", "local-tasks-npm-install"]
//[USAGE] flag "--output <directory>" help="Output directory; defaults to docs/images/reception-info"
//[USAGE] flag "--maps" help="Also export RBN and PSK SVG layout previews and native map scene JSON"

import { mkdtemp, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import {
  previewReceptionInfo,
  type ReceptionPreviewRuntime,
} from '../../../scripts/reception-info-preview.ts'

const root = process.cwd()
// Runtime source includes sandbox JSON imports. Bundle those exactly as the
// extension build does, without relaxing the native-Node task typecheck.
const temporary = await mkdtemp(join(root, 'node_modules/.reception-preview-'))
try {
  const bundle = join(temporary, 'runtime.mjs')
  await build({
    stdin: {
      contents: [
        "export { panelModel } from './extensions/tools/n1rwj-rbn/src/panel.ts'",
        "export { pskPanelModel } from './extensions/tools/n1rwj-psk-reporter/src/panel.ts'",
        "export { renderReceptionScene } from './packages/reception/src/ui/scene.ts'",
      ].join('\n'),
      resolveDir: root,
      sourcefile: 'reception-preview-runtime.ts',
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  })
  const runtime = (await import(pathToFileURL(bundle).href)) as ReceptionPreviewRuntime
  await previewReceptionInfo(
    resolve(root, process.env.usage_output ?? 'docs/images/reception-info'),
    runtime,
    process.env.usage_maps === 'true',
  )
} finally {
  await rm(temporary, { recursive: true, force: true })
}
