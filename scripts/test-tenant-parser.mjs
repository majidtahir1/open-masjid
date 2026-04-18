#!/usr/bin/env node
/**
 * Sanity tests for `parseHostContext`.
 *
 * Run with:
 *   node --experimental-strip-types scripts/test-tenant-parser.mjs
 *
 * (On Node 22+, `--experimental-strip-types` lets us import `.ts` files
 * directly without a build step.)
 */

import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const parseModulePath = resolve(here, '../src/lib/tenant-parse.ts')

const { parseHostContext } = await import(parseModulePath)

let failures = 0
function check(label, actual, expected) {
  try {
    assert.deepEqual(actual, expected)
    console.log(`ok   ${label}`)
  } catch (err) {
    failures++
    console.error(`FAIL ${label}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     actual:   ${JSON.stringify(actual)}`)
  }
}

check(
  'openmasjid.app → platform-marketing',
  parseHostContext('openmasjid.app'),
  { type: 'platform-marketing' },
)

check(
  'www.openmasjid.app → platform-marketing',
  parseHostContext('www.openmasjid.app'),
  { type: 'platform-marketing' },
)

check(
  'admin.openmasjid.app → platform-admin',
  parseHostContext('admin.openmasjid.app'),
  { type: 'platform-admin' },
)

check(
  'icp.openmasjid.app → tenant-subdomain(icp)',
  parseHostContext('icp.openmasjid.app'),
  { type: 'tenant-subdomain', slug: 'icp' },
)

check(
  'icp.openmasjid.app:3000 → tenant-subdomain(icp) (port stripped)',
  parseHostContext('icp.openmasjid.app:3000'),
  { type: 'tenant-subdomain', slug: 'icp' },
)

check(
  'icprosper.org → tenant-custom(icprosper.org)',
  parseHostContext('icprosper.org'),
  { type: 'tenant-custom', host: 'icprosper.org' },
)

check(
  'www.icprosper.org → tenant-custom(icprosper.org) (www stripped)',
  parseHostContext('www.icprosper.org'),
  { type: 'tenant-custom', host: 'icprosper.org' },
)

check('localhost → localhost', parseHostContext('localhost'), { type: 'localhost' })
check(
  'localhost:3000 → localhost',
  parseHostContext('localhost:3000'),
  { type: 'localhost' },
)
check(
  '127.0.0.1:3000 → localhost',
  parseHostContext('127.0.0.1:3000'),
  { type: 'localhost' },
)

// A few extra edge cases worth locking in:
check('empty host → localhost', parseHostContext(''), { type: 'localhost' })
check(
  'uppercase normalization (ICP.OpenMasjid.App)',
  parseHostContext('ICP.OpenMasjid.App'),
  { type: 'tenant-subdomain', slug: 'icp' },
)
check(
  'celina.openmasjid.app → tenant-subdomain(celina)',
  parseHostContext('celina.openmasjid.app'),
  { type: 'tenant-subdomain', slug: 'celina' },
)
check(
  'iccelina.org → tenant-custom(iccelina.org)',
  parseHostContext('iccelina.org'),
  { type: 'tenant-custom', host: 'iccelina.org' },
)
check(
  'nested subdomain (foo.bar.openmasjid.app) → tenant-custom (falls through)',
  parseHostContext('foo.bar.openmasjid.app'),
  { type: 'tenant-custom', host: 'foo.bar.openmasjid.app' },
)
check(
  'dev.localhost → localhost',
  parseHostContext('dev.localhost'),
  { type: 'localhost' },
)

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`)
  process.exit(1)
} else {
  console.log('\nall tests passed')
}
