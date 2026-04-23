# Auto-calculate Adhan Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat per-season prayer schedules with a range-based model. Admins pick a date range; the system computes per-day adhan times from the masjid's location + calculation method via the `adhan` library; admins configure iqamah in bulk (absolute time or offset from adhan, per prayer) with per-day override.

**Architecture:** Tenant gains a `location` (lat/lng/timezone) and `prayerCalc` (method/madhab) group. Address changes auto-geocode via Nominatim. PrayerSchedule gains `endDate`, `iqamahRules`, and an embedded `days[]` array. Two custom Payload endpoints do the heavy lifting: `generate-prayer-times` (fills `days[]` from adhan calc) and `apply-iqamah-rules` (rewrites iqamah from rules, preserves adhan). A custom admin UI field renders Generate + Apply buttons on the schedule edit view. Public read path resolves the active schedule, then looks up today's entry in `days[]`.

**Tech Stack:** Next.js 15, Payload CMS 3.39, Postgres, React 19, `adhan` (batoulapps), Nominatim, vitest (new, test framework).

**Spec:** `docs/superpowers/specs/2026-04-23-auto-adhan-times-design.md`

---

## Task 1: Set up vitest as the project's test runner

No test framework exists yet (one ad-hoc script at `scripts/test-tenant-parser.mjs`). Pure-function tests for adhan calc, iqamah rules, and geocoding are load-bearing for this ticket, so we wire up vitest minimally.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install vitest**

```
npm install --save-dev vitest @vitest/coverage-v8
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
      '@payload-config': path.resolve(dirname, 'src/payload.config.ts'),
    },
  },
})
```

- [ ] **Step 3: Add `test` and `test:watch` scripts to `package.json`**

In the `"scripts"` block, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs**

Run: `npm test`
Expected: "No test files found" (exit 0 or similar). If it errors on module resolution, check the alias config.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest for unit tests (#19)"
```

---

## Task 2: Install the `adhan` library

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

```
npm install adhan
```

- [ ] **Step 2: Verify import works**

Run: `node -e "import('adhan').then(m => console.log(Object.keys(m)))"`
Expected: prints exported names (e.g. `Coordinates`, `PrayerTimes`, `CalculationMethod`, ...).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add adhan calculation library (#19)"
```

---

## Task 3: Implement `src/lib/adhan.ts` — adhan time calculator

Pure wrapper: {lat, lng, timezone, method, madhab, date} → {fajr, zuhr, asr, maghrib, isha} as formatted `h:mm AM/PM` strings.

**Files:**
- Create: `src/lib/adhan.ts`
- Create: `tests/lib/adhan.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/adhan.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeAdhanTimes, type AdhanMethod, type AsrMadhab } from '@/lib/adhan'

describe('computeAdhanTimes', () => {
  it('returns formatted times for a known date/location (ICP Prosper, ISNA, Standard, 2026-06-15)', () => {
    const result = computeAdhanTimes({
      lat: 33.2257,
      lng: -96.7969,
      timezone: 'America/Chicago',
      method: 'ISNA',
      madhab: 'Standard',
      date: new Date('2026-06-15T12:00:00Z'),
    })
    // Sanity checks: ordering + non-empty. Exact values are library-dependent;
    // this test locks the contract, not specific values.
    expect(result.fajr).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
    expect(result.isha).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
    expect(result.fajr).not.toBe(result.isha)
  })

  it('respects Hanafi asr madhab (Hanafi asr is later than Standard)', () => {
    const args = {
      lat: 33.2257,
      lng: -96.7969,
      timezone: 'America/Chicago',
      method: 'ISNA' as AdhanMethod,
      date: new Date('2026-06-15T12:00:00Z'),
    }
    const standard = computeAdhanTimes({ ...args, madhab: 'Standard' as AsrMadhab })
    const hanafi = computeAdhanTimes({ ...args, madhab: 'Hanafi' as AsrMadhab })
    expect(standard.asr).not.toBe(hanafi.asr)
  })

  it('formats times without leading zero on hour (3:45 AM, not 03:45 AM)', () => {
    const result = computeAdhanTimes({
      lat: 33.2257,
      lng: -96.7969,
      timezone: 'America/Chicago',
      method: 'ISNA',
      madhab: 'Standard',
      date: new Date('2026-06-15T12:00:00Z'),
    })
    expect(result.fajr).not.toMatch(/^0\d:/)
  })
})
```

- [ ] **Step 2: Run test — should fail (module missing)**

```
npm test -- adhan
```

Expected: FAIL with "Cannot find module '@/lib/adhan'".

- [ ] **Step 3: Implement `src/lib/adhan.ts`**

```ts
import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from 'adhan'

export type AdhanMethod =
  | 'ISNA'
  | 'MWL'
  | 'Egyptian'
  | 'UmmAlQura'
  | 'Karachi'
  | 'Tehran'
  | 'Jafari'

export type AsrMadhab = 'Standard' | 'Hanafi'

export interface AdhanInput {
  lat: number
  lng: number
  timezone: string // IANA
  method: AdhanMethod
  madhab: AsrMadhab
  date: Date
}

export interface AdhanTimes {
  fajr: string
  zuhr: string
  asr: string
  maghrib: string
  isha: string
}

const METHOD_MAP: Record<AdhanMethod, () => CalculationParameters> = {
  ISNA: () => CalculationMethod.NorthAmerica(),
  MWL: () => CalculationMethod.MuslimWorldLeague(),
  Egyptian: () => CalculationMethod.Egyptian(),
  UmmAlQura: () => CalculationMethod.UmmAlQura(),
  Karachi: () => CalculationMethod.Karachi(),
  Tehran: () => CalculationMethod.Tehran(),
  Jafari: () => CalculationMethod.Other(),
}

function formatTime(d: Date, timezone: string): string {
  // Intl formatter honors IANA zones; en-US gives 12-hour with AM/PM.
  const formatted = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(d)
  // Intl outputs "3:45 AM" (no leading zero on hour) — return as-is.
  return formatted
}

export function computeAdhanTimes(input: AdhanInput): AdhanTimes {
  const coords = new Coordinates(input.lat, input.lng)
  const params = METHOD_MAP[input.method]()
  params.madhab = input.madhab === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi
  const prayerTimes = new PrayerTimes(coords, input.date, params)

  return {
    fajr: formatTime(prayerTimes.fajr, input.timezone),
    zuhr: formatTime(prayerTimes.dhuhr, input.timezone),
    asr: formatTime(prayerTimes.asr, input.timezone),
    maghrib: formatTime(prayerTimes.maghrib, input.timezone),
    isha: formatTime(prayerTimes.isha, input.timezone),
  }
}
```

- [ ] **Step 4: Run tests — should pass**

```
npm test -- adhan
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adhan.ts tests/lib/adhan.test.ts
git commit -m "feat: adhan time calculator wrapper (#19)"
```

---

## Task 4: Implement `src/lib/iqamah.ts` — iqamah rule applier

Pure function: given `{ mode, value }` rule + adhan time string, returns the iqamah string.

**Files:**
- Create: `src/lib/iqamah.ts`
- Create: `tests/lib/iqamah.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/iqamah.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { applyIqamahRule, type IqamahRule } from '@/lib/iqamah'

describe('applyIqamahRule', () => {
  it('returns the absolute value verbatim when mode=absolute', () => {
    const rule: IqamahRule = { mode: 'absolute', value: '5:45 AM' }
    expect(applyIqamahRule(rule, '5:30 AM')).toBe('5:45 AM')
  })

  it('adds offset minutes to adhan when mode=offset', () => {
    const rule: IqamahRule = { mode: 'offset', value: 5 }
    expect(applyIqamahRule(rule, '8:30 PM')).toBe('8:35 PM')
  })

  it('crosses the hour when offset pushes past 60 minutes', () => {
    const rule: IqamahRule = { mode: 'offset', value: 45 }
    expect(applyIqamahRule(rule, '5:30 AM')).toBe('6:15 AM')
  })

  it('crosses AM→PM correctly', () => {
    const rule: IqamahRule = { mode: 'offset', value: 40 }
    expect(applyIqamahRule(rule, '11:30 AM')).toBe('12:10 PM')
  })

  it('returns empty string for absolute mode with empty value', () => {
    const rule: IqamahRule = { mode: 'absolute', value: '' }
    expect(applyIqamahRule(rule, '5:30 AM')).toBe('')
  })

  it('returns empty string when offset is applied to an unparseable adhan', () => {
    const rule: IqamahRule = { mode: 'offset', value: 5 }
    expect(applyIqamahRule(rule, 'at sunset')).toBe('')
  })
})
```

- [ ] **Step 2: Run — should fail**

```
npm test -- iqamah
```

Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/iqamah.ts`**

```ts
export type IqamahRule =
  | { mode: 'absolute'; value: string }
  | { mode: 'offset'; value: number }

/**
 * Parse a "h:mm AM/PM" string into minutes since midnight. Returns null on
 * any format deviation — callers should treat null as "cannot derive iqamah".
 */
function parseTime(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hour = parseInt(match[1], 10)
  const minute = parseInt(match[2], 10)
  const isPm = match[3].toUpperCase() === 'PM'
  if (hour === 12) hour = 0
  if (isPm) hour += 12
  return hour * 60 + minute
}

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(normalized / 60)
  const minute = normalized % 60
  const isPm = hour24 >= 12
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  const mm = minute.toString().padStart(2, '0')
  return `${hour12}:${mm} ${isPm ? 'PM' : 'AM'}`
}

export function applyIqamahRule(rule: IqamahRule, adhan: string): string {
  if (rule.mode === 'absolute') return rule.value || ''
  const base = parseTime(adhan)
  if (base === null) return ''
  return formatTime(base + rule.value)
}
```

- [ ] **Step 4: Run — should pass**

```
npm test -- iqamah
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/iqamah.ts tests/lib/iqamah.test.ts
git commit -m "feat: iqamah rule applier (#19)"
```

---

## Task 5: Implement `src/lib/geocode.ts` — Nominatim client

Given an address string, calls Nominatim and returns `{lat, lng} | null`. Includes User-Agent per Nominatim usage policy.

**Files:**
- Create: `src/lib/geocode.ts`
- Create: `tests/lib/geocode.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/lib/geocode.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { geocodeAddress } from '@/lib/geocode'

describe('geocodeAddress', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns {lat, lng} when Nominatim responds with a result', async () => {
    const mockResponse = new Response(
      JSON.stringify([{ lat: '33.2257', lon: '-96.7969' }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse) as typeof fetch

    const result = await geocodeAddress('861 N Coleman St, Prosper, TX')
    expect(result).toEqual({ lat: 33.2257, lng: -96.7969 })
  })

  it('sends a User-Agent header per Nominatim policy', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('[]', { status: 200 }),
    ) as typeof fetch
    globalThis.fetch = mockFetch

    await geocodeAddress('test')
    const call = (mockFetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('User-Agent')).toMatch(/OpenMasjid/)
  })

  it('returns null when Nominatim returns no results', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('[]', { status: 200 })) as typeof fetch

    const result = await geocodeAddress('zzz nonexistent zzz')
    expect(result).toBeNull()
  })

  it('returns null when Nominatim returns a non-ok status', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('error', { status: 500 })) as typeof fetch

    const result = await geocodeAddress('test')
    expect(result).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network')) as typeof fetch

    const result = await geocodeAddress('test')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run — should fail**

```
npm test -- geocode
```

- [ ] **Step 3: Implement `src/lib/geocode.ts`**

```ts
/**
 * Nominatim (OpenStreetMap) geocoder. Free, no API key.
 *
 * Per Nominatim Usage Policy, callers MUST identify themselves via a
 * meaningful User-Agent. See https://operations.osmfoundation.org/policies/nominatim/
 *
 * Rate limit: 1 req/sec sustained. For a masjid admin saving their address
 * once, that ceiling is irrelevant. If we ever batch geocode, add a queue.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'OpenMasjid/1.0 (https://openmasjid.app)'

export interface Coordinates {
  lat: number
  lng: number
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  if (!address || !address.trim()) return null

  const url = new URL(NOMINATIM_URL)
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!res.ok) return null

    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
    const first = data[0]
    if (!first || !first.lat || !first.lon) return null

    const lat = parseFloat(first.lat)
    const lng = parseFloat(first.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    return { lat, lng }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run — should pass**

```
npm test -- geocode
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/geocode.ts tests/lib/geocode.test.ts
git commit -m "feat: Nominatim geocoder (#19)"
```

---

## Task 6: Add `location` + `prayerCalc` fields to Tenants collection

**Files:**
- Modify: `src/collections/Tenants.ts`

- [ ] **Step 1: Add the fields**

Add a new tab named "Prayer Calculation" between "Branding" and "Contact" tabs:

```ts
{
  label: 'Prayer Calculation',
  description:
    'Required for auto-calculating adhan times. The masjid location + calculation method drive per-day adhan times.',
  fields: [
    {
      name: 'location',
      type: 'group',
      label: 'Location',
      admin: {
        description:
          'Masjid coordinates and timezone. Lat/lng are auto-filled from the address on save. Override manually if the geocoder picks the wrong point.',
      },
      fields: [
        {
          name: 'lat',
          type: 'number',
          label: 'Latitude',
          admin: {
            description: 'Decimal degrees (e.g. 33.2257 for Prosper, TX).',
            placeholder: '33.2257',
          },
        },
        {
          name: 'lng',
          type: 'number',
          label: 'Longitude',
          admin: {
            description: 'Decimal degrees (e.g. -96.7969 for Prosper, TX).',
            placeholder: '-96.7969',
          },
        },
        {
          name: 'timezone',
          type: 'text',
          label: 'Timezone',
          admin: {
            description:
              'IANA timezone for the masjid (e.g. America/Chicago, America/New_York). See https://en.wikipedia.org/wiki/List_of_tz_database_time_zones.',
            placeholder: 'America/Chicago',
          },
        },
      ],
    },
    {
      name: 'prayerCalc',
      type: 'group',
      label: 'Calculation Method',
      admin: {
        description:
          'Select the calculation convention your community follows. ISNA is the default in North America.',
      },
      fields: [
        {
          name: 'method',
          type: 'select',
          defaultValue: 'ISNA',
          label: 'Method',
          options: [
            { label: 'ISNA (North America)', value: 'ISNA' },
            { label: 'Muslim World League', value: 'MWL' },
            { label: 'Egyptian General Authority', value: 'Egyptian' },
            { label: 'Umm al-Qura (Makkah)', value: 'UmmAlQura' },
            { label: 'University of Islamic Sciences, Karachi', value: 'Karachi' },
            { label: 'Institute of Geophysics, Tehran', value: 'Tehran' },
            { label: 'Shia Ithna-Ashari, Jafari', value: 'Jafari' },
          ],
        },
        {
          name: 'asrMadhab',
          type: 'select',
          defaultValue: 'Standard',
          label: 'Asr Madhab',
          options: [
            { label: 'Standard (Shafi/Maliki/Hanbali)', value: 'Standard' },
            { label: 'Hanafi', value: 'Hanafi' },
          ],
        },
      ],
    },
  ],
},
```

- [ ] **Step 2: Run Payload type generation**

```
npm run generate:types
```

Expected: `src/payload-types.ts` updates with the new `location` and `prayerCalc` groups on Tenant.

- [ ] **Step 3: Smoke-test by booting dev and editing a tenant**

```
npm run dev
```

Open admin → Tenants → ICP → Prayer Calculation tab. Fields render. Save with test values. No errors.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Tenants.ts src/payload-types.ts
git commit -m "feat: add Tenants.location + prayerCalc fields (#19)"
```

---

## Task 7: Add geocoding beforeChange hook to Tenants

When `contactInfo.address` changes and `location.lat/lng` is empty, geocode.

**Files:**
- Create: `src/hooks/geocodeTenantAddress.ts`
- Modify: `src/collections/Tenants.ts`

- [ ] **Step 1: Create the hook**

`src/hooks/geocodeTenantAddress.ts`:

```ts
import type { CollectionBeforeChangeHook } from 'payload'

import { geocodeAddress } from '@/lib/geocode'

/**
 * If the tenant's address changed and lat/lng are empty, geocode via
 * Nominatim. Admin can always override manually.
 */
export const geocodeTenantAddress: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
}) => {
  const address = (data?.contactInfo as { address?: string } | undefined)?.address
  const location = (data?.location as { lat?: number; lng?: number } | undefined) ?? {}
  const previousAddress = (
    originalDoc?.contactInfo as { address?: string } | undefined
  )?.address

  if (!address) return data
  if (location.lat && location.lng) return data // manual override stays
  if (operation === 'update' && address === previousAddress) return data

  const coords = await geocodeAddress(address)
  if (!coords) return data

  data.location = {
    ...location,
    lat: coords.lat,
    lng: coords.lng,
  }
  return data
}
```

- [ ] **Step 2: Wire the hook into Tenants**

In `src/collections/Tenants.ts`, add at the collection level:

```ts
hooks: {
  beforeChange: [geocodeTenantAddress],
},
```

Add the import at the top:

```ts
import { geocodeTenantAddress } from '../hooks/geocodeTenantAddress'
```

- [ ] **Step 3: Smoke-test**

```
npm run dev
```

Admin → Tenants → ICP → clear `location.lat`/`lng` → save → refresh → lat/lng populated from the address. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/geocodeTenantAddress.ts src/collections/Tenants.ts
git commit -m "feat: auto-geocode tenant address on save (#19)"
```

---

## Task 8: Reshape PrayerSchedules collection

Replace flat `fajr/zuhr/...` with `iqamahRules` + `days[]`. Add `endDate`.

**Files:**
- Modify: `src/collections/PrayerSchedules.ts`

- [ ] **Step 1: Read the current shape to understand the existing structure**

Read `src/collections/PrayerSchedules.ts` end-to-end so the diff makes sense.

- [ ] **Step 2: Replace the per-prayer collapsibles and Jummah block**

Keep: `name`, `startDate`, `notes`, `tenant`, `activeBanner` UI field, `defaultSort: '-startDate'`.

Remove: the top-level `fajr/zuhr/asr/maghrib/isha` groups (they were flat, one pair per schedule).

Add after `startDate`:

```ts
{
  name: 'endDate',
  type: 'date',
  required: true,
  index: true,
  admin: {
    date: { pickerAppearance: 'dayOnly' },
    description:
      'Last day this schedule covers. The generator builds one day-row per date from startDate through endDate (inclusive).',
    components: {
      Field: '/src/fields/DateField#default',
    },
  },
  validate: (value: unknown, { data }: { data?: { startDate?: string } }) => {
    if (!value || !data?.startDate) return true
    if (new Date(value as string) < new Date(data.startDate)) {
      return 'End date must be on or after Start date.'
    }
    return true
  },
},
{
  name: 'iqamahRules',
  type: 'group',
  label: 'Iqamah Rules',
  admin: {
    description:
      'Bulk iqamah for every day in the range. Each prayer is either an absolute time or an offset from the computed adhan. Maghrib is usually an offset (e.g. "+5 min after sunset"); others are usually absolute. Use "Apply iqamah to range" after changing these to rewrite all days.',
  },
  fields: (['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const).map((prayer) => ({
    name: prayer,
    type: 'group' as const,
    label: prayer.charAt(0).toUpperCase() + prayer.slice(1),
    fields: [
      {
        name: 'mode',
        type: 'select' as const,
        required: true,
        defaultValue: prayer === 'maghrib' ? 'offset' : 'absolute',
        label: 'Mode',
        options: [
          { label: 'Absolute time (same clock time every day)', value: 'absolute' },
          { label: 'Offset from adhan (N min after adhan)', value: 'offset' },
        ],
      },
      {
        name: 'absoluteValue',
        type: 'text' as const,
        label: 'Absolute Time',
        admin: {
          description: 'Example: "5:45 AM". Used when Mode = absolute.',
          placeholder: '5:45 AM',
          condition: (_: unknown, sibling: unknown) =>
            (sibling as { mode?: string })?.mode === 'absolute',
        },
      },
      {
        name: 'offsetMinutes',
        type: 'number' as const,
        label: 'Offset (minutes)',
        defaultValue: prayer === 'maghrib' ? 5 : 15,
        admin: {
          description: 'Whole minutes added to the computed adhan. Used when Mode = offset.',
          condition: (_: unknown, sibling: unknown) =>
            (sibling as { mode?: string })?.mode === 'offset',
        },
      },
    ],
  })),
},
{
  name: 'jummahTimes',
  type: 'array',
  label: 'Jummah Times',
  labels: { singular: 'Jummah Time', plural: 'Jummah Times' },
  admin: {
    description:
      'Absolute times for Friday Jummah (e.g. 12:45 PM, 1:30 PM, 2:15 PM). Replaces Zuhr iqamah on Fridays on the public site.',
  },
  fields: [
    {
      name: 'time',
      type: 'text',
      required: true,
      admin: { placeholder: '12:45 PM' },
    },
  ],
},
{
  name: 'days',
  type: 'array',
  label: 'Generated Days',
  labels: { singular: 'Day', plural: 'Days' },
  admin: {
    description:
      'One row per date in the range. Populated by the "Generate times" button. Each row can be edited individually; re-running bulk actions overwrites.',
    initCollapsed: true,
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    ...(['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const).map((prayer) => ({
      name: prayer,
      type: 'group' as const,
      label: prayer.charAt(0).toUpperCase() + prayer.slice(1),
      fields: [
        { name: 'adhan', type: 'text' as const, admin: { placeholder: '5:30 AM' } },
        { name: 'iqamah', type: 'text' as const, admin: { placeholder: '5:45 AM' } },
      ],
    })),
  ],
},
```

- [ ] **Step 3: Regenerate types**

```
npm run generate:types
```

- [ ] **Step 4: Smoke-test schema**

```
npm run dev
```

Boot must succeed. Admin → Prayer Schedules renders with the new fields. Stop dev. (Existing DB rows may show as "invalid" until we reseed — that's expected.)

- [ ] **Step 5: Commit**

```bash
git add src/collections/PrayerSchedules.ts src/payload-types.ts
git commit -m "feat: reshape PrayerSchedules for daily rows + iqamah rules (#19)"
```

---

## Task 9: Implement `src/endpoints/generatePrayerTimes.ts`

Custom Payload endpoint. Takes `{ scheduleId }` → computes adhan for every date in range → applies iqamah rules → writes `days[]`.

**Files:**
- Create: `src/endpoints/generatePrayerTimes.ts`
- Modify: `src/payload.config.ts` (register endpoint)

- [ ] **Step 1: Create the endpoint**

`src/endpoints/generatePrayerTimes.ts`:

```ts
import type { Endpoint, PayloadHandler } from 'payload'

import { computeAdhanTimes, type AdhanMethod, type AsrMadhab } from '@/lib/adhan'
import { applyIqamahRule, type IqamahRule } from '@/lib/iqamah'

type IqamahRulesShape = Record<
  'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha',
  { mode: 'absolute' | 'offset'; absoluteValue?: string | null; offsetMinutes?: number | null }
>

function ruleFor(entry: IqamahRulesShape[keyof IqamahRulesShape]): IqamahRule {
  if (entry.mode === 'offset') {
    return { mode: 'offset', value: entry.offsetMinutes ?? 0 }
  }
  return { mode: 'absolute', value: entry.absoluteValue ?? '' }
}

function* datesInRange(startISO: string, endISO: string) {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  while (cursor.getTime() <= stop.getTime()) {
    yield new Date(cursor)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
}

const handler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json?.()) as { scheduleId?: string | number } | undefined
  const scheduleId = body?.scheduleId
  if (!scheduleId) return Response.json({ error: 'scheduleId required' }, { status: 400 })

  const schedule = (await payload.findByID({
    collection: 'prayer-schedules',
    id: scheduleId,
    depth: 1,
    overrideAccess: false,
    user,
  })) as Record<string, unknown>

  if (!schedule) return Response.json({ error: 'Schedule not found' }, { status: 404 })

  const tenantRel = schedule.tenant as { id?: string | number } | string | number
  const tenantId =
    typeof tenantRel === 'object' && tenantRel !== null ? tenantRel.id : tenantRel
  if (!tenantId) return Response.json({ error: 'Schedule has no tenant' }, { status: 400 })

  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as {
    location?: { lat?: number; lng?: number; timezone?: string }
    prayerCalc?: { method?: AdhanMethod; asrMadhab?: AsrMadhab }
  }

  const lat = tenant.location?.lat
  const lng = tenant.location?.lng
  const timezone = tenant.location?.timezone
  const method = tenant.prayerCalc?.method
  const madhab = tenant.prayerCalc?.asrMadhab ?? 'Standard'

  if (lat == null || lng == null || !timezone || !method) {
    return Response.json(
      {
        error:
          'Tenant is missing required calculation config. Set lat/lng/timezone and prayerCalc.method before generating.',
      },
      { status: 400 },
    )
  }

  const startDate = schedule.startDate as string | null
  const endDate = schedule.endDate as string | null
  if (!startDate || !endDate) {
    return Response.json(
      { error: 'Schedule requires both startDate and endDate.' },
      { status: 400 },
    )
  }

  const rules = schedule.iqamahRules as IqamahRulesShape | undefined
  if (!rules) return Response.json({ error: 'iqamahRules missing' }, { status: 400 })

  const days: Array<Record<string, unknown>> = []
  for (const date of datesInRange(startDate, endDate)) {
    const adhan = computeAdhanTimes({ lat, lng, timezone, method, madhab, date })
    const row: Record<string, unknown> = { date: date.toISOString() }
    ;(['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const).forEach((prayer) => {
      row[prayer] = {
        adhan: adhan[prayer],
        iqamah: applyIqamahRule(ruleFor(rules[prayer]), adhan[prayer]),
      }
    })
    days.push(row)
  }

  await payload.update({
    collection: 'prayer-schedules',
    id: scheduleId,
    data: { days },
    overrideAccess: false,
    user,
  })

  return Response.json({ ok: true, dayCount: days.length })
}

export const generatePrayerTimesEndpoint: Endpoint = {
  path: '/generate-prayer-times',
  method: 'post',
  handler,
}
```

- [ ] **Step 2: Register the endpoint in `src/payload.config.ts`**

At the top of `buildConfig({...})`, add (after `admin: {...}`):

```ts
endpoints: [generatePrayerTimesEndpoint],
```

Import at top:

```ts
import { generatePrayerTimesEndpoint } from './endpoints/generatePrayerTimes'
```

- [ ] **Step 3: Smoke-test the endpoint via curl**

Boot dev (`npm run dev`). Log in as admin. Grab a JWT from the admin's Network tab, or use the admin UI later once we add the button. Skip manual curl if the button comes in the next task.

- [ ] **Step 4: Commit**

```bash
git add src/endpoints/generatePrayerTimes.ts src/payload.config.ts
git commit -m "feat: generate-prayer-times Payload endpoint (#19)"
```

---

## Task 10: Implement `src/endpoints/applyIqamahRules.ts`

Rewrites iqamah in each existing `days[]` entry using current `iqamahRules`, preserving adhan. Use when admin tweaks a rule without wanting to regenerate.

**Files:**
- Create: `src/endpoints/applyIqamahRules.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create the endpoint**

`src/endpoints/applyIqamahRules.ts`:

```ts
import type { Endpoint, PayloadHandler } from 'payload'

import { applyIqamahRule, type IqamahRule } from '@/lib/iqamah'

type IqamahRulesShape = Record<
  'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha',
  { mode: 'absolute' | 'offset'; absoluteValue?: string | null; offsetMinutes?: number | null }
>

function ruleFor(entry: IqamahRulesShape[keyof IqamahRulesShape]): IqamahRule {
  if (entry.mode === 'offset') return { mode: 'offset', value: entry.offsetMinutes ?? 0 }
  return { mode: 'absolute', value: entry.absoluteValue ?? '' }
}

type DayShape = Record<
  'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha',
  { adhan?: string | null; iqamah?: string | null }
> & { date: string; id?: string }

const handler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json?.()) as { scheduleId?: string | number } | undefined
  const scheduleId = body?.scheduleId
  if (!scheduleId) return Response.json({ error: 'scheduleId required' }, { status: 400 })

  const schedule = (await payload.findByID({
    collection: 'prayer-schedules',
    id: scheduleId,
    depth: 0,
    overrideAccess: false,
    user,
  })) as Record<string, unknown>

  const rules = schedule.iqamahRules as IqamahRulesShape | undefined
  const days = (schedule.days as DayShape[] | undefined) ?? []
  if (!rules) return Response.json({ error: 'iqamahRules missing' }, { status: 400 })
  if (days.length === 0) {
    return Response.json(
      { error: 'No days to update. Run "Generate times" first.' },
      { status: 400 },
    )
  }

  const updatedDays = days.map((d) => {
    const next: DayShape = { ...d }
    ;(['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const).forEach((p) => {
      const adhan = d[p]?.adhan ?? ''
      next[p] = { adhan, iqamah: applyIqamahRule(ruleFor(rules[p]), adhan) }
    })
    return next
  })

  await payload.update({
    collection: 'prayer-schedules',
    id: scheduleId,
    data: { days: updatedDays },
    overrideAccess: false,
    user,
  })

  return Response.json({ ok: true, dayCount: updatedDays.length })
}

export const applyIqamahRulesEndpoint: Endpoint = {
  path: '/apply-iqamah-rules',
  method: 'post',
  handler,
}
```

- [ ] **Step 2: Register in `src/payload.config.ts`**

```ts
endpoints: [generatePrayerTimesEndpoint, applyIqamahRulesEndpoint],
```

Add import.

- [ ] **Step 3: Commit**

```bash
git add src/endpoints/applyIqamahRules.ts src/payload.config.ts
git commit -m "feat: apply-iqamah-rules Payload endpoint (#19)"
```

---

## Task 11: Admin UI — "Generate times" + "Apply iqamah" buttons

Custom Payload UI field mounted at the top of the PrayerSchedule edit view. Buttons call the two endpoints.

**Files:**
- Create: `src/admin/GenerateTimesButton.tsx`
- Modify: `src/collections/PrayerSchedules.ts`

- [ ] **Step 1: Create the component**

`src/admin/GenerateTimesButton.tsx`:

```tsx
'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import React, { useState } from 'react'

function confirmOverwrite(count?: number): boolean {
  const msg = count
    ? `This will overwrite ${count} days. Continue?`
    : 'This will overwrite existing day rows. Continue?'
  return typeof window !== 'undefined' && window.confirm(msg)
}

export default function GenerateTimesButton() {
  const { id, savedDocumentData } = useDocumentInfo()
  const [busy, setBusy] = useState<null | 'generate' | 'apply'>(null)
  const [message, setMessage] = useState<string>('')

  const existingDayCount = Array.isArray(
    (savedDocumentData as { days?: unknown[] } | undefined)?.days,
  )
    ? ((savedDocumentData as { days: unknown[] }).days.length)
    : 0

  async function callEndpoint(path: string) {
    if (!id) {
      setMessage('Save the schedule first — generation needs a saved id.')
      return
    }
    try {
      const res = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: id }),
        credentials: 'include',
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        dayCount?: number
        error?: string
      }
      if (!res.ok || !json.ok) {
        setMessage(json.error ?? `Request failed (${res.status})`)
        return
      }
      setMessage(`Done — ${json.dayCount ?? 0} day(s) updated. Refresh to see.`)
    } catch (err) {
      setMessage((err as Error).message)
    }
  }

  async function onGenerate() {
    if (existingDayCount > 0 && !confirmOverwrite(existingDayCount)) return
    setBusy('generate')
    setMessage('')
    await callEndpoint('generate-prayer-times')
    setBusy(null)
  }

  async function onApplyIqamah() {
    if (existingDayCount > 0 && !confirmOverwrite(existingDayCount)) return
    setBusy('apply')
    setMessage('')
    await callEndpoint('apply-iqamah-rules')
    setBusy(null)
  }

  return (
    <div className="field-type ui-field" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn--style-primary"
          onClick={onGenerate}
          disabled={busy !== null}
        >
          {busy === 'generate' ? 'Generating…' : 'Generate times'}
        </button>
        <button
          type="button"
          className="btn btn--style-secondary"
          onClick={onApplyIqamah}
          disabled={busy !== null}
        >
          {busy === 'apply' ? 'Applying…' : 'Apply iqamah to range'}
        </button>
        {message ? (
          <span style={{ fontSize: 13, color: 'var(--theme-text)' }}>{message}</span>
        ) : null}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--theme-text-light)' }}>
        Generate fills every day in the range with adhan from tenant coordinates and iqamah from the rules below.
        Apply only rewrites iqamah from rules — preserves existing adhan.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Mount the component via a UI field in PrayerSchedules**

In `src/collections/PrayerSchedules.ts`, add near the top of `fields` (after `activeBanner`, before `name`):

```ts
{
  name: 'generateActions',
  type: 'ui',
  admin: {
    components: {
      Field: '/src/admin/GenerateTimesButton#default',
    },
  },
},
```

- [ ] **Step 3: Regenerate importMap**

```
npx payload generate:importmap
```

- [ ] **Step 4: Smoke-test**

`npm run dev`. Admin → PrayerSchedules → a saved doc. Buttons render at the top. Click "Generate times"; if tenant lacks location, expect an error toast-style message. Fill tenant location, retry. Days array populates.

Stop dev.

- [ ] **Step 5: Commit**

```bash
git add src/admin/GenerateTimesButton.tsx src/collections/PrayerSchedules.ts src/app/\(payload\)/admin/importMap.js
git commit -m "feat: Generate/Apply buttons on PrayerSchedule edit view (#19)"
```

---

## Task 12: Rework `src/lib/prayer-schedule.ts` to resolve today's day entry

Active-schedule resolver now needs `startDate ≤ today ≤ endDate` and must return today's entry from `days[]`.

**Files:**
- Modify: `src/lib/prayer-schedule.ts`
- Create: `tests/lib/prayer-schedule.test.ts` (optional — integration test, may skip if the DB-facing code is hard to isolate)

- [ ] **Step 1: Rewrite `getActiveSchedule` and add a helper for today's row**

Replace the existing `getActiveSchedule` + `PrayerScheduleRecord` with:

```ts
export interface PrayerDayRow {
  date?: string | null
  fajr?: { adhan?: string | null; iqamah?: string | null } | null
  zuhr?: { adhan?: string | null; iqamah?: string | null } | null
  asr?: { adhan?: string | null; iqamah?: string | null } | null
  maghrib?: { adhan?: string | null; iqamah?: string | null } | null
  isha?: { adhan?: string | null; iqamah?: string | null } | null
}

export interface PrayerScheduleRecord {
  id: string | number
  name?: string | null
  startDate?: string | null
  endDate?: string | null
  jummahTimes?: Array<{ time?: string | null } | string> | null
  notes?: string | null
  days?: PrayerDayRow[] | null
}

export async function getActiveSchedule(
  tenantId: string | number,
  date: Date = new Date(),
): Promise<PrayerScheduleRecord | null> {
  noStore()
  const payload = await payloadClient()
  const iso = date.toISOString()

  try {
    const res = await payload.find({
      collection: 'prayer-schedules',
      where: {
        tenant: { equals: tenantId },
        startDate: { less_than_equal: iso },
        endDate: { greater_than_equal: iso },
      },
      sort: '-startDate',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return (res.docs[0] as PrayerScheduleRecord) ?? null
  } catch {
    return null
  }
}

/**
 * Find the `days[]` row whose date matches the given date (compared by
 * YYYY-MM-DD). Returns null if the schedule has no row for that date.
 */
export function findDayRow(
  schedule: PrayerScheduleRecord | null,
  date: Date = new Date(),
): PrayerDayRow | null {
  if (!schedule?.days?.length) return null
  const target = date.toISOString().slice(0, 10)
  return (
    schedule.days.find((d) => (d.date ? d.date.slice(0, 10) === target : false)) ?? null
  )
}
```

Keep `getAllSchedules` as-is (it's used by the timeline widget; legacy tolerance is fine).

- [ ] **Step 2: Commit**

```bash
git add src/lib/prayer-schedule.ts
git commit -m "refactor: prayer-schedule resolver returns today's day row (#19)"
```

---

## Task 13: Update PrayerTimesPage + PrayerStrip to read from `days[]`

**Files:**
- Modify: `src/app/(site)/prayer-times/page.tsx`
- Modify: `src/components/PrayerStrip.tsx`
- Modify: `src/app/api/active-schedule/route.ts` (if the mobile strip reads from it)

- [ ] **Step 1: Update prayer-times page**

In `src/app/(site)/prayer-times/page.tsx`, replace the `active` read so it uses today's row:

```ts
import { findDayRow, getActiveSchedule } from '@/lib/prayer-schedule'

// inside the component:
const active = await getActiveSchedule(tenant.id)
const today = findDayRow(active)
```

Downstream, replace any reference to `active.fajr` etc. with `today?.fajr`. If `today` is null but `active` exists, fall back to "Prayer times for today are being updated" or similar.

- [ ] **Step 2: Update PrayerStrip and any route that returns today's times**

Open `src/components/PrayerStrip.tsx`, `src/app/api/active-schedule/route.ts`, `src/app/api/active-schedules/route.ts`. Any path reading `schedule.fajr.adhan` needs to go through `findDayRow(schedule).fajr.adhan` instead.

- [ ] **Step 3: Smoke test**

Boot dev (after Task 15 so we have seeded data), visit `/prayer-times` and the homepage. Verify today's times render. Stop dev.

- [ ] **Step 4: Commit**

```bash
git add src/app src/components/PrayerStrip.tsx
git commit -m "feat: public site reads today's row from days[] (#19)"
```

---

## Task 14: Update `ActiveScheduleBanner` copy

The banner currently says "this schedule is active now." Expand to reflect the new range model.

**Files:**
- Modify: `src/admin/ActiveScheduleBanner.tsx`

- [ ] **Step 1: Update copy**

When the schedule is active (startDate ≤ today ≤ endDate), show:

> "This schedule is active today. Range: <startDate> → <endDate>. <N> days configured."

When it's future:

> "Not yet active. Starts <startDate>."

When past:

> "Expired. Ended <endDate>."

- [ ] **Step 2: Commit**

```bash
git add src/admin/ActiveScheduleBanner.tsx
git commit -m "chore: update active-schedule banner for range model (#19)"
```

---

## Task 15: Update `scripts/seed.ts` for new shape

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Set ICP tenant calc config**

In the ICP create/update block (`icpData`), add:

```ts
location: {
  lat: 33.2257,
  lng: -96.7969,
  timezone: 'America/Chicago',
},
prayerCalc: {
  method: 'ISNA',
  asrMadhab: 'Standard',
},
```

- [ ] **Step 2: Replace the `schedules` block**

Remove the flat `fajr/zuhr/...` literals. Seed one realistic schedule with startDate/endDate + iqamahRules + empty `days[]`, and one Ramadan example:

```ts
const schedules = [
  {
    name: 'Summer 2026',
    startDate: new Date('2026-06-01T00:00:00Z').toISOString(),
    endDate: new Date('2026-08-31T00:00:00Z').toISOString(),
    iqamahRules: {
      fajr: { mode: 'absolute', absoluteValue: '5:00 AM' },
      zuhr: { mode: 'absolute', absoluteValue: '1:45 PM' },
      asr: { mode: 'absolute', absoluteValue: '6:15 PM' },
      maghrib: { mode: 'offset', offsetMinutes: 5 },
      isha: { mode: 'absolute', absoluteValue: '10:15 PM' },
    },
    jummahTimes: [{ time: '12:45 PM' }, { time: '1:30 PM' }, { time: '2:15 PM' }],
    days: [],
    notes: 'Summer hours — later Isha.',
  },
  {
    name: 'Ramadan 2026',
    startDate: new Date('2026-02-18T00:00:00Z').toISOString(),
    endDate: new Date('2026-03-19T00:00:00Z').toISOString(),
    iqamahRules: {
      fajr: { mode: 'absolute', absoluteValue: '5:30 AM' },
      zuhr: { mode: 'absolute', absoluteValue: '1:45 PM' },
      asr: { mode: 'absolute', absoluteValue: '5:30 PM' },
      maghrib: { mode: 'offset', offsetMinutes: 0 },
      isha: { mode: 'absolute', absoluteValue: '9:00 PM' },
    },
    jummahTimes: [{ time: '12:45 PM' }, { time: '1:30 PM' }, { time: '2:15 PM' }],
    days: [],
    notes: 'Taraweeh after Isha — 20 rakahs.',
  },
]
```

- [ ] **Step 3: Add a post-seed call to generate days for each schedule**

After seed loops, for each created schedule, call the generator:

```ts
for (const seeded of createdSchedules) {
  const res = await fetch(`http://localhost:3000/api/generate-prayer-times`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${platformOwnerToken}`, // see step 4
    },
    body: JSON.stringify({ scheduleId: seeded.id }),
  }).catch(() => null)
  // Non-fatal: if dev server isn't running, skip.
}
```

- [ ] **Step 4: Alternative — call generator directly in-process**

If running `npm run seed` without a live dev server, extract the core of `generatePrayerTimes` into a function (e.g. `src/lib/generateDays.ts`) that the endpoint calls AND the seed can call. Choose whichever the implementer finds cleaner — pick one, note the decision in the commit message.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed.ts src/lib/generateDays.ts
git commit -m "chore: seed with new PrayerSchedule shape + lat/lng (#19)"
```

---

## Task 16: Wipe + reseed; end-to-end smoke

**Files:**
- No code changes. Exercising the system.

- [ ] **Step 1: Wipe the dev DB**

```
docker compose down -v
docker compose up -d
```

- [ ] **Step 2: Run seed**

```
npm run seed
```

Expected: platform owner + ICP tenant (with lat/lng + calc method) + admin + all content + two schedules, each with ~90 `days[]` entries populated.

- [ ] **Step 3: Boot + manual QA**

```
npm run dev
```

1. Log in at `/admin`.
2. Go to Tenants → ICP → Prayer Calculation tab. Verify lat/lng/timezone/method all populated.
3. Go to PrayerSchedules → Summer 2026. Scroll to `days[]`. Spot-check day 1, day 45, day 90: adhan values in `h:mm AM/PM`, iqamah matches rules (Maghrib = adhan + 5 min, others absolute).
4. Edit Summer 2026 → change Fajr iqamah rule from "5:00 AM" to "4:55 AM" → click "Apply iqamah to range" → refresh → verify day 1..90 fajr.iqamah updated.
5. Change startDate by 5 days → click "Generate times" → confirm modal → verify `days[]` starts from new date.
6. Open `/` and `/prayer-times` on the public site. Verify today's times render. Verify Jummah replacement on Friday (if today is Friday, or temporarily shift the schedule to cover last Friday for the test).

- [ ] **Step 4: Note any defects found**

If anything is off, fix it and commit. If nothing, skip to next task.

---

## Task 17: Regenerate types + cleanup commit

- [ ] **Step 1: Regenerate types one more time**

```
npm run generate:types
```

- [ ] **Step 2: If anything changed, commit**

```bash
git add src/payload-types.ts
git commit -m "chore: regenerate payload-types (#19)" || echo "nothing to commit"
```

---

## Task 18: Open PR

- [ ] **Step 1: Push the branch**

```
git push -u origin feat/19-auto-adhan-times
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat: auto-calculate adhan times from masjid location (#19)" --body "Closes #19. See docs/superpowers/specs/2026-04-23-auto-adhan-times-design.md for the design and docs/superpowers/plans/2026-04-23-auto-adhan-times.md for the plan."
```

- [ ] **Step 3: Board update**

Leave board item #19 on **In Progress** until user QAs. Move to **Done** after approval.

---

## Self-Review Notes

- **Spec coverage:** All sections of the spec map to tasks — tenant fields (Task 6), geocode (Task 7), schedule reshape (Task 8), endpoints (Tasks 9, 10), admin UI (Task 11), read path (Tasks 12, 13), banner copy (Task 14), migration (Tasks 15, 16).
- **Testing:** Pure functions (`adhan`, `iqamah`, `geocode`) have unit tests (Tasks 3–5). DB-facing code (endpoints, read path) is manually QA'd in Task 16 — adding integration tests against a real Postgres is out of scope for this ticket.
- **Type consistency:** `IqamahRule` shape is consistent across `iqamah.ts`, endpoints, and the collection field. `AdhanMethod`/`AsrMadhab` identical in `adhan.ts` and endpoints.
- **Decisions deferred to implementation:** Task 15 Step 4 — in-process vs. HTTP call for seed-time day generation. Either is fine; the implementer picks.
- **Not addressed here:** DST transition warnings, Hijri display, Nominatim rate-limit queueing. All flagged out-of-scope in spec.
