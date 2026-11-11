import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { withAboutFiles } from '@ham2k/extension-tools'
import { pack, settingsReviewReasons } from '@ham2k/extension-tools/format'
import { type Manifest, readJson, selectExtensions } from './extensions.ts'

export async function packExtensions(root: string, key?: string): Promise<void> {
  const builds = []
  for (const extension of await selectExtensions(root, key)) {
    const buildDir = join(extension.dir, 'build')
    const manifest = await readJson<Manifest>(join(buildDir, 'manifest.json'))
    const expected = await withAboutFiles(extension.manifest, extension.dir)
    if (!isDeepStrictEqual(manifest, expected)) {
      throw new Error(`${extension.manifest.key}: build manifest is stale; run mise run build`)
    }
    const reviewReasons = settingsReviewReasons(manifest)
    if (reviewReasons.length) {
      const reasons = reviewReasons.join('\n')
      throw new Error(`${manifest.key} settings placement requires catalog review.\n${reasons}`)
    }
    builds.push({ buildDir, manifest })
  }

  const dist = join(root, 'dist')
  await mkdir(dist, { recursive: true })
  for (const { buildDir, manifest } of builds) {
    const filename = `${manifest.key}-${manifest.version}.h2kext`
    const outPath = join(dist, filename)
    // This is the validator/packer invoked by the official h2kext-pack CLI.
    await pack(buildDir, { outPath })
    const checksum = createHash('sha256')
      .update(await readFile(outPath))
      .digest('hex')
    await writeFile(`${outPath}.sha256`, `${checksum}  ${filename}\n`)
    console.log(`Validated and packed ${outPath}\nSHA-256 ${checksum}`)
  }
}
