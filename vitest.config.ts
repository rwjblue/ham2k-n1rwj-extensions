import { availableParallelism } from 'node:os'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Sandbox bundles and scene-layout checks share CPU with the installed app.
    // Bound worker startup and allow their assertions to finish on busy hosts.
    maxWorkers: Math.min(4, availableParallelism()),
    testTimeout: 15_000,
    // The published SDK imports JSON without Node import attributes; Vite
    // must transform those imports before Node can execute the SDK in tests.
    server: { deps: { inline: ['@ham2k/extension-sdk'] } },
  },
})
