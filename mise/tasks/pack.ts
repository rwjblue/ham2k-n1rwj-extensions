#!/usr/bin/env -S node --experimental-strip-types
//[MISE] description="Build and officially validate installable extensions in dist/"
//[MISE] depends=[{ task = "build", args = ["{{ usage.key | default(value='') }}"] }, "local-tasks-npm-install"]
//[USAGE] arg "[key]" help="Extension key to package; omit to package every extension"

import { packExtensions } from '../../scripts/lib/pack.ts'

await packExtensions(process.cwd(), process.env.usage_key)
