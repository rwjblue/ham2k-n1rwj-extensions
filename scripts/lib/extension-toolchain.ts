import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as publishedBuild from '@ham2k/extension-tools'
import * as publishedFormat from '@ham2k/extension-tools/format'
import type { Extension } from './extensions.ts'

export async function extensionToolchain(extension: Extension) {
  if (!extension.package.preview) return { build: publishedBuild, format: publishedFormat }

  const require = createRequire(join(extension.dir, 'package.json'))
  const [build, format]: [typeof publishedBuild, typeof publishedFormat] = await Promise.all([
    import(pathToFileURL(require.resolve('@ham2k/extension-tools')).href),
    import(pathToFileURL(require.resolve('@ham2k/extension-tools/format')).href),
  ])
  return { build, format }
}
