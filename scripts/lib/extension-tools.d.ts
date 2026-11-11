// @ham2k/extension-tools publishes JavaScript without declarations.
// These signatures cover the public functions used by our build tasks.
declare module '@ham2k/extension-tools' {
  import type { build } from 'esbuild'
  export function buildExtension(
    esbuild: typeof build,
    options: { dir: string },
  ): Promise<{ outDir: string; manifest: { key: string; version: string } }>
  export function withAboutFiles(
    manifest: Record<string, unknown>,
    dir: string,
  ): Promise<Record<string, unknown>>
}

declare module '@ham2k/extension-tools/format' {
  export function pack(dir: string, options: { outPath: string }): Promise<unknown>
  export function keyProblem(key: unknown): string | null
  export const SCAFFOLD_SHARED_DEPENDENCIES: Record<string, string>
}
