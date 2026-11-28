import { cp, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { buildExtensions } from '../../../../scripts/lib/build.ts'
import { discoverExtensions } from '../../../../scripts/lib/extensions.ts'
import { packExtensions } from '../../../../scripts/lib/pack.ts'
import manifest from '../manifest.json'

test('the preview packs with its own official tools while automatic discovery excludes it', async () => {
  const root = resolve('.')
  const temp = await mkdtemp(join(tmpdir(), 'operation-location-preview-'))
  try {
    const dirname = fileURLToPath(new URL('..', import.meta.url))
    const preview = join(temp, 'extensions', 'tools', manifest.key)
    await mkdir(preview, { recursive: true })
    for (const entry of ['manifest.json', 'package.json', 'ABOUT.md', 'src']) {
      await cp(join(dirname, entry), join(preview, entry), { recursive: true })
    }
    await symlink(join(dirname, 'node_modules'), join(preview, 'node_modules'), 'dir')
    await mkdir(join(temp, 'docs'))
    for (const entry of ['LICENSE', 'NOTICE.md', 'docs/PROVENANCE.md']) {
      await cp(join(root, entry), join(temp, entry))
    }

    expect(await discoverExtensions(temp)).toEqual([])
    await buildExtensions(temp, manifest.key)
    await packExtensions(temp, manifest.key)
    const packedManifest = JSON.parse(
      await readFile(join(preview, 'build', 'manifest.json'), 'utf8'),
    )
    expect(packedManifest).toMatchObject({
      api: 31,
      requiresLocation: true,
      hooks: ['dataFile', 'operationLocation'],
    })
    const bundle = join(temp, 'dist', `${manifest.key}-${manifest.version}.h2kext`)
    expect((await readFile(bundle)).subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
