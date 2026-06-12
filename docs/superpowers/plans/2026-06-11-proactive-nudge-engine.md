# Proactive Nudge Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the OpenMasjid side of the Proactive Nudge Engine — a rules registry + pipeline that watches a masjid's data, plus `/api/ansari/nudges*` endpoints that Hermes polls hourly to deliver suggest-and-confirm nudges via Telegram.

**Architecture:** Pure rule objects (`evaluate(ctx) → Finding[]` with injected `now`) live in `src/ansari/rules/`; a pipeline orchestrates select → evaluate → resolution-sweep → dedup → timing gates → emit, persisting lifecycle in a `NudgeStates` Payload collection. Custom endpoints (`GET /api/ansari/nudges`, `POST …/:id/ack|apply|dismiss|snooze|mute`) gate on a new `ansari:nudges` API scope. Hermes (separate repo, out of scope here) does voice + Telegram.

**Tech Stack:** Payload CMS 3.84 (Postgres), Next.js, Vitest, native `Intl` for timezone/Hijri math (no date library). Spec: `docs/superpowers/specs/2026-05-31-proactive-nudge-engine-design.md` (read it first).

**Conventions that bind every task:**
- Tests: Vitest, no globals — `import { describe, it, expect, vi } from 'vitest'`. Run one file: `npm test -- tests/ansari/<file>.test.ts`.
- Imports use `@/` → `src/`. Strict TypeScript (`npx tsc --noEmit` must stay clean).
- Payload is mocked in tests as a plain object with `vi.fn()` methods (see `tests/lib/cloneTenantContent.test.ts` for the house pattern) — never boot real Payload in unit tests.
- All server-side reads/writes inside rules/pipeline/endpoints use `overrideAccess: true` (authorization happens once, at the endpoint boundary).
- The cut `donations.milestone` rule is **not** in this plan (deferred to capability-surface v1.1).

**Dependency order:** Tasks 1–5 are foundations; Tasks 6–11 (rules) each depend on 1–3 (+5 for Task 7) but not on each other; Task 12 needs 6–11; Tasks 13–14 need 12; Task 15 is last.

---

### Task 1: Export time math from `src/lib/iqamah.ts`

The drift rule and snapshot hook need `parseTime`/`formatTime`, currently private.

**Files:**
- Modify: `src/lib/iqamah.ts:5` and `src/lib/iqamah.ts:16`

- [ ] **Step 1: Add `export` to both functions**

In `src/lib/iqamah.ts` change line 5 `function parseTime(` → `export function parseTime(` and line 16 `function formatTime(` → `export function formatTime(`. No other changes.

- [ ] **Step 2: Verify existing tests still pass and types are clean**

Run: `npm test -- tests/lib/iqamah.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/iqamah.ts
git commit -m "refactor(ansari): export parseTime/formatTime for nudge rules"
```

---

### Task 2: Timezone/calendar helpers — `src/ansari/time.ts`

**Files:**
- Create: `src/ansari/time.ts`
- Test: `tests/ansari/time.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/time.test.ts
import { describe, expect, it } from 'vitest'
import {
  addDays,
  endOfNextMonthISO,
  hijriParts,
  isoWeekKey,
  localDateISO,
  localParts,
  tzOffsetMinutes,
} from '@/ansari/time'

const CHI = 'America/Chicago'

describe('localParts / localDateISO', () => {
  it('converts a UTC instant to tenant-local parts', () => {
    // 2026-06-11T03:00Z = 2026-06-10 22:00 in Chicago (CDT, UTC-5)
    const p = localParts(new Date('2026-06-11T03:00:00Z'), CHI)
    expect(p).toMatchObject({ year: 2026, month: 6, day: 10, hour: 22, minute: 0, weekday: 3 })
    expect(localDateISO(new Date('2026-06-11T03:00:00Z'), CHI)).toBe('2026-06-10')
  })
})

describe('tzOffsetMinutes', () => {
  it('returns -300 for Chicago in summer (CDT) and -360 in winter (CST)', () => {
    expect(tzOffsetMinutes(new Date('2026-06-15T12:00:00Z'), CHI)).toBe(-300)
    expect(tzOffsetMinutes(new Date('2026-01-15T12:00:00Z'), CHI)).toBe(-360)
  })
})

describe('hijriParts', () => {
  it('maps a Gregorian date into the islamic-umalqura calendar', () => {
    const h = hijriParts(new Date('2026-06-11T12:00:00Z'), CHI)
    expect(h.year).toBeGreaterThanOrEqual(1447)
    expect(h.month).toBeGreaterThanOrEqual(1)
    expect(h.month).toBeLessThanOrEqual(12)
    expect(h.day).toBeGreaterThanOrEqual(1)
    expect(h.day).toBeLessThanOrEqual(30)
  })

  it('finds 1 Ramadan 1447 in February 2026', () => {
    // Umm al-Qura: Ramadan 1447 begins ~17-18 Feb 2026; scan a window and expect exactly one "day 1"
    let firsts = 0
    for (let i = 0; i < 35; i++) {
      const h = hijriParts(addDays(new Date('2026-02-01T12:00:00Z'), i), CHI)
      if (h.month === 9 && h.day === 1) firsts++
    }
    expect(firsts).toBe(1)
  })
})

describe('isoWeekKey', () => {
  it('is stable within a week and rolls over on Monday (ISO)', () => {
    // 2026-06-11 is a Thursday → ISO week 24
    expect(isoWeekKey(new Date('2026-06-11T12:00:00Z'), CHI)).toBe('2026-W24')
    expect(isoWeekKey(new Date('2026-06-14T12:00:00Z'), CHI)).toBe('2026-W24') // Sunday, same ISO week
    expect(isoWeekKey(new Date('2026-06-15T12:00:00Z'), CHI)).toBe('2026-W25') // Monday
  })
})

describe('addDays / endOfNextMonthISO', () => {
  it('addDays adds exact 24h multiples', () => {
    expect(addDays(new Date('2026-06-11T00:00:00Z'), 3).toISOString()).toBe('2026-06-14T00:00:00.000Z')
  })
  it('endOfNextMonthISO returns the last day of the following local month', () => {
    expect(endOfNextMonthISO(new Date('2026-06-15T12:00:00Z'), CHI)).toBe('2026-07-31')
    expect(endOfNextMonthISO(new Date('2026-12-15T12:00:00Z'), CHI)).toBe('2027-01-31')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/time.test.ts`
Expected: FAIL — cannot resolve `@/ansari/time`.

- [ ] **Step 3: Implement `src/ansari/time.ts`**

```typescript
// src/ansari/time.ts
// Tenant-local time math via Intl — no date library, mirrors src/lib/adhan.ts / hijri.ts.

const DAY_MS = 86_400_000
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type LocalParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
  weekday: number // 0=Sunday … 6=Saturday
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export function localParts(date: Date, timeZone: string): LocalParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: parts.hour === '24' ? 0 : Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  }
}

export function localDateISO(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/** Minutes east of UTC at `date` in `timeZone` (Chicago summer = -300). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === '24' ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return Math.round((asUTC - date.getTime()) / 60_000)
}

/** Hijri (islamic-umalqura) parts for `date` as seen in `timeZone`. Ramadan = month 9. */
export function hijriParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const make = (tz: string | undefined) =>
    new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
  let formatted
  try {
    formatted = make(timeZone).formatToParts(date)
  } catch {
    formatted = make(undefined).formatToParts(date)
  }
  const parts: Record<string, string> = {}
  for (const p of formatted) parts[p.type] = p.value
  return { year: parseInt(parts.year, 10), month: Number(parts.month), day: Number(parts.day) }
}

/** ISO-8601 week key of the tenant-local date, e.g. '2026-W24'. */
export function isoWeekKey(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' of the last day of the month AFTER the one containing `date` (tenant-local). */
export function endOfNextMonthISO(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone)
  const last = new Date(Date.UTC(p.year, p.month + 1, 0)) // day 0 of month+2 = last of month+1
  return last.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/ansari/time.test.ts`
Expected: PASS. If the "1 Ramadan 1447" test fails, debug by printing `hijriParts` over Feb–Mar 2026 — the scan-window asserts *existence of exactly one* day-1, so only an Intl data gap would break it; widen the window to 60 days from 2026-02-01 if Node's umalqura mapping differs by a few days.

- [ ] **Step 5: Commit**

```bash
git add src/ansari/time.ts tests/ansari/time.test.ts
git commit -m "feat(ansari): timezone/hijri/iso-week helpers for nudge rules"
```

---

### Task 3: Rule framework types — `src/ansari/types.ts` + `src/ansari/ruleIds.ts`

**Files:**
- Create: `src/ansari/types.ts`
- Create: `src/ansari/ruleIds.ts`

- [ ] **Step 1: Create `src/ansari/ruleIds.ts`** (tiny module so collections can import rule ids without pulling in rule code)

```typescript
// src/ansari/ruleIds.ts
export const RULE_IDS = [
  'prayer.coverage_gap',
  'prayer.iqamah_drift',
  'calendar.dst',
  'calendar.ramadan',
  'forms.capacity',
  'announcements.expiring',
  'events.low_rsvp',
  'events.missing_flyer',
  'digest.weekly',
] as const

export type RuleId = (typeof RULE_IDS)[number]
```

- [ ] **Step 2: Create `src/ansari/types.ts`**

```typescript
// src/ansari/types.ts
import type { Payload } from 'payload'
import type { RuleId } from './ruleIds'

export type NudgeTier = 'immediate' | 'digest'
export type NudgeCategory = 'prayer' | 'calendar' | 'forms' | 'announcements' | 'events' | 'digest'

/**
 * What [Yes] would do. 'direct' = idempotent write executed by /apply after
 * re-validation. 'conversation-starter' = multi-step; /apply returns a handoff
 * marker and Hermes continues in the reactive chat flow.
 */
export type ActionDescriptor =
  | { kind: 'direct'; op: string; params: Record<string, unknown>; summary: string }
  | { kind: 'conversation-starter'; topic: string; summary: string }

export type Finding = {
  /** "Is this the SAME problem?" — stable while the problem is unchanged. */
  dedupKey: string
  /** Structured, machine-readable intent — Hermes does the wording. */
  intent: Record<string, unknown>
  action: ActionDescriptor
}

export type NudgeContext = {
  payload: Payload
  tenant: { id: string | number; timezone: string }
  /** Injected, never read from the clock — keeps rules unit-testable. */
  now: Date
}

export type Rule = {
  id: RuleId
  category: NudgeCategory
  tier: NudgeTier
  /** Underlying write scope an API key must hold for /apply to execute. */
  requiredScope?: string
  evaluate(ctx: NudgeContext): Promise<Finding[]>
  /** Only for rules whose action kind is 'direct'. */
  execute?(ctx: NudgeContext, finding: Finding): Promise<{ ok: true; detail: string }>
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/ansari/types.ts src/ansari/ruleIds.ts
git commit -m "feat(ansari): nudge rule framework types"
```

---

### Task 4: Collections (`AnsariSettings`, `NudgeStates`) + `ansari:nudges` scope

**Files:**
- Create: `src/collections/AnsariSettings.ts`
- Create: `src/collections/NudgeStates.ts`
- Modify: `src/payload.config.ts` (collections array, ~line 154 — the list mapped through `withApiKeyScopeEnforcement`)
- Modify: `src/collections/Users.ts:358-372` (`apiScopes` options)

Note: neither new collection goes into `SCOPE_MAP` in `src/access/apiScoped.ts` — scoped API keys are default-denied on unmapped collections, which is what we want (Hermes talks only to the custom endpoints; pipeline code uses `overrideAccess: true`).

- [ ] **Step 1: Create `src/collections/AnsariSettings.ts`**

First open `src/collections/Announcements.ts` and copy its exact import paths for `tenantScoped*` access functions and the `setTenantFromUser` hook (they live in `src/access/tenantScoped.ts` and `src/hooks/` — match whatever specifier style that file uses).

```typescript
// src/collections/AnsariSettings.ts
import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { RULE_IDS } from '../ansari/ruleIds'

export const AnsariSettings: CollectionConfig = {
  slug: 'ansari-settings',
  labels: { singular: 'Ansari Settings', plural: 'Ansari Settings' },
  admin: {
    group: 'Ansari',
    description:
      'Proactive nudge preferences for this masjid: which nudges are on, quiet hours, and the weekly digest slot.',
    useAsTitle: 'id',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Proactive nudges enabled',
    },
    {
      name: 'disabledRules',
      type: 'select',
      hasMany: true,
      label: 'Disabled nudge types',
      options: RULE_IDS.map((id) => ({ label: id, value: id })),
      admin: {
        description: 'Nudge types Ansari will stay silent about ("Stop these" also lands here).',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'quietHoursStart',
          type: 'number',
          defaultValue: 21,
          min: 0,
          max: 23,
          label: 'Quiet from (hour, 0-23)',
          admin: { width: '50%', description: 'No immediate nudges from this local hour…' },
        },
        {
          name: 'quietHoursEnd',
          type: 'number',
          defaultValue: 8,
          min: 0,
          max: 23,
          label: 'Quiet until (hour, 0-23)',
          admin: { width: '50%', description: '…until this local hour.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'digestDay',
          type: 'select',
          defaultValue: '0',
          label: 'Weekly digest day',
          options: [
            { label: 'Sunday', value: '0' },
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'digestHour',
          type: 'number',
          defaultValue: 9,
          min: 0,
          max: 23,
          label: 'Digest hour (local, 0-23)',
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'telegramConnected',
      type: 'checkbox',
      defaultValue: false,
      label: 'Telegram connected',
      admin: { description: 'Set when Hermes binds a Telegram chat to this masjid.' },
    },
  ],
}
```

- [ ] **Step 2: Create `src/collections/NudgeStates.ts`**

```typescript
// src/collections/NudgeStates.ts
import type { Access, CollectionConfig } from 'payload'

import { tenantScopedRead } from '../access/tenantScoped'

// Lifecycle writes happen server-side with overrideAccess: true; humans only read.
const serverOnly: Access = ({ req: { user } }) =>
  (user as { role?: string } | null)?.role === 'platformOwner'

export const NudgeStates: CollectionConfig = {
  slug: 'nudge-states',
  labels: { singular: 'Nudge State', plural: 'Nudge States' },
  admin: {
    group: 'Ansari',
    description: 'Dedup + lifecycle bookkeeping for proactive nudges. Managed by the engine.',
    defaultColumns: ['rule', 'dedupKey', 'status', 'emittedAt'],
  },
  access: {
    read: tenantScopedRead,
    create: serverOnly,
    update: serverOnly,
    delete: serverOnly,
  },
  timestamps: true,
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'rule', type: 'text', required: true, index: true },
    { name: 'dedupKey', type: 'text', required: true, index: true },
    {
      name: 'tier',
      type: 'select',
      required: true,
      options: [
        { label: 'Immediate', value: 'immediate' },
        { label: 'Digest', value: 'digest' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'emitted',
      index: true,
      options: [
        { label: 'Emitted (awaiting Hermes ack)', value: 'emitted' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Applied', value: 'applied' },
        { label: 'Dismissed', value: 'dismissed' },
        { label: 'Snoozed (Not now)', value: 'snoozed' },
        { label: 'Resolved', value: 'resolved' },
      ],
    },
    { name: 'intent', type: 'json' },
    { name: 'action', type: 'json' },
    { name: 'emittedAt', type: 'date' },
    { name: 'deliveredAt', type: 'date' },
    { name: 'snoozedAt', type: 'date' },
    { name: 'resolvedAt', type: 'date' },
  ],
}
```

- [ ] **Step 3: Register both collections in `src/payload.config.ts`**

Add imports near the other collection imports, then add `AnsariSettings,` and `NudgeStates,` to the collections array (inside the list that gets `.map(withApiKeyScopeEnforcement)`).

- [ ] **Step 4: Add the scope option in `src/collections/Users.ts`**

In the `apiScopes` field options array (after the `members:read` entry, before `media:read`):

```typescript
    { label: 'Ansari — nudges', value: 'ansari:nudges' },
```

- [ ] **Step 5: Typecheck + existing tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean / all pass. (`src/payload-types.ts` regeneration happens in Task 15 — until then, code in later tasks must not rely on generated types for the new collections; it doesn't.)

- [ ] **Step 6: Commit**

```bash
git add src/collections/AnsariSettings.ts src/collections/NudgeStates.ts src/payload.config.ts src/collections/Users.ts
git commit -m "feat(ansari): AnsariSettings + NudgeStates collections and ansari:nudges scope"
```

---

### Task 5: `Events.signupForm` field, `gapAtCreation` snapshot field + hook

**Files:**
- Modify: `src/collections/Events.ts` (add `signupForm` near the other sidebar fields)
- Modify: `src/collections/PrayerSchedules.ts:18-71` (`iqamahRuleFields`) and `:112` (hooks array)
- Create: `src/hooks/snapshotIqamahGaps.ts`
- Test: `tests/hooks/snapshotIqamahGaps.test.ts`

- [ ] **Step 1: Add `signupForm` to Events**

In `src/collections/Events.ts`, after the `flyerImage` field (line ~255), add:

```typescript
    {
      name: 'signupForm',
      type: 'relationship',
      relationTo: 'forms',
      label: 'Signup / RSVP form',
      admin: {
        position: 'sidebar',
        description:
          'Optional — link the RSVP form for this event so signup counts can be tracked (used by Ansari nudges).',
      },
    },
```

- [ ] **Step 2: Add the hidden snapshot field to `iqamahRuleFields`**

In `src/collections/PrayerSchedules.ts`, inside `iqamahRuleFields`, the prayer group's `fields` array currently holds one `row`. Add a hidden number after the row (so the group fields array becomes `[ { type: 'row', … }, { name: 'gapAtCreation', … } ]`):

```typescript
        {
          name: 'gapAtCreation',
          type: 'number' as const,
          admin: { hidden: true },
        },
```

- [ ] **Step 3: Write the failing hook test**

```typescript
// tests/hooks/snapshotIqamahGaps.test.ts
import { describe, expect, it } from 'vitest'
import { snapshotIqamahGaps } from '@/hooks/snapshotIqamahGaps'

const day = (date: string, fajrAdhan: string, fajrIqamah: string) => ({
  date,
  fajr: { adhan: fajrAdhan, iqamah: fajrIqamah },
  zuhr: { adhan: '1:30 PM', iqamah: '1:45 PM' },
  asr: { adhan: '5:00 PM', iqamah: '5:15 PM' },
  maghrib: { adhan: '8:30 PM', iqamah: '8:35 PM' },
  isha: { adhan: '10:00 PM', iqamah: '10:15 PM' },
})

const baseRules = {
  fajr: { mode: 'absolute', absoluteValue: '6:00 AM' },
  zuhr: { mode: 'offset', offsetMinutes: 15 },
  asr: { mode: 'offset', offsetMinutes: 15 },
  maghrib: { mode: 'offset', offsetMinutes: 5 },
  isha: { mode: 'offset', offsetMinutes: 15 },
}

function run(data: Record<string, unknown>, originalDoc?: Record<string, unknown>) {
  // hook signature: ({ data, originalDoc }) => data
  return snapshotIqamahGaps({ data, originalDoc } as never) as Promise<Record<string, unknown>>
}

describe('snapshotIqamahGaps', () => {
  it('snapshots iqamah-minus-adhan for a newly set absolute value', async () => {
    const data = {
      iqamahRules: structuredClone(baseRules),
      days: [day('2099-01-01T00:00:00.000Z', '5:30 AM', '6:00 AM')],
    }
    const out = await run(data)
    expect((out.iqamahRules as typeof baseRules).fajr).toMatchObject({ gapAtCreation: 30 })
  })

  it('re-snapshots when the absolute value changes', async () => {
    const data = {
      iqamahRules: { ...structuredClone(baseRules), fajr: { mode: 'absolute', absoluteValue: '6:15 AM', gapAtCreation: 30 } },
      days: [day('2099-01-01T00:00:00.000Z', '5:30 AM', '6:15 AM')],
    }
    const original = { iqamahRules: structuredClone(baseRules) } // had 6:00 AM
    const out = await run(data, original)
    expect((out.iqamahRules as typeof baseRules).fajr).toMatchObject({ gapAtCreation: 45 })
  })

  it('leaves an existing snapshot alone when the value is unchanged', async () => {
    const rules = { ...structuredClone(baseRules), fajr: { mode: 'absolute', absoluteValue: '6:00 AM', gapAtCreation: 22 } }
    const data = { iqamahRules: structuredClone(rules), days: [day('2099-01-01T00:00:00.000Z', '5:30 AM', '6:00 AM')] }
    const out = await run(data, { iqamahRules: structuredClone(rules) })
    expect((out.iqamahRules as typeof baseRules).fajr).toMatchObject({ gapAtCreation: 22 })
  })

  it('ignores offset-mode prayers and missing days', async () => {
    const out = await run({ iqamahRules: structuredClone(baseRules), days: [] })
    expect((out.iqamahRules as typeof baseRules).zuhr).not.toHaveProperty('gapAtCreation')
  })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- tests/hooks/snapshotIqamahGaps.test.ts`
Expected: FAIL — cannot resolve `@/hooks/snapshotIqamahGaps`.

- [ ] **Step 5: Implement `src/hooks/snapshotIqamahGaps.ts`**

```typescript
// src/hooks/snapshotIqamahGaps.ts
import type { CollectionBeforeChangeHook } from 'payload'

import { parseTime } from '@/lib/iqamah'

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const

type RuleShape = { mode?: string; absoluteValue?: string | null; gapAtCreation?: number | null }
type DayRow = { date?: string | null } & Record<string, unknown>

/**
 * Records the gap the admin INTENDED when setting an absolute iqamah time:
 * gapAtCreation = iqamah − adhan on the first relevant day at save time.
 * The drift nudge restores this gap instead of guessing a universal target.
 *
 * Must run AFTER autoRegeneratePrayerDays in the beforeChange array so
 * data.days reflects the saved range/rules.
 */
export const snapshotIqamahGaps: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
  const rules = data?.iqamahRules as Record<string, RuleShape> | undefined
  if (!rules) return data

  const days = ((data?.days ?? originalDoc?.days) as DayRow[] | undefined) ?? []
  if (days.length === 0) return data

  const todayISO = new Date().toISOString().slice(0, 10)
  const refDay =
    days.find((d) => typeof d.date === 'string' && d.date.slice(0, 10) >= todayISO) ?? days[0]

  for (const prayer of PRAYERS) {
    const rule = rules[prayer]
    if (!rule || rule.mode !== 'absolute' || !rule.absoluteValue) continue

    const origValue =
      ((originalDoc?.iqamahRules as Record<string, RuleShape> | undefined)?.[prayer]
        ?.absoluteValue as string | null | undefined) ?? null
    const changed = rule.absoluteValue !== origValue
    if (!changed && rule.gapAtCreation != null) continue

    const adhan = parseTime(
      ((refDay[prayer] as { adhan?: string | null } | undefined)?.adhan as string) ?? '',
    )
    const iqamah = parseTime(rule.absoluteValue)
    if (adhan == null || iqamah == null) continue
    rule.gapAtCreation = iqamah - adhan
  }
  return data
}
```

- [ ] **Step 6: Register the hook in `src/collections/PrayerSchedules.ts`**

Line 112, append after `autoRegeneratePrayerDays` (order matters — it reads the regenerated `data.days`):

```typescript
    beforeChange: [setTenantFromUser, trimDaysToRange, autoRegeneratePrayerDays, snapshotIqamahGaps],
```

with the import added at the top: `import { snapshotIqamahGaps } from '../hooks/snapshotIqamahGaps'`.

- [ ] **Step 7: Run tests + typecheck**

Run: `npm test -- tests/hooks/snapshotIqamahGaps.test.ts && npx tsc --noEmit`
Expected: PASS / clean.

- [ ] **Step 8: Commit**

```bash
git add src/collections/Events.ts src/collections/PrayerSchedules.ts src/hooks/snapshotIqamahGaps.ts tests/hooks/snapshotIqamahGaps.test.ts
git commit -m "feat(ansari): signupForm on events + iqamah gapAtCreation snapshot hook"
```

---

### Task 6: Shared test helper + rule `prayer.coverage_gap`

**Files:**
- Create: `tests/ansari/helpers.ts`
- Create: `src/ansari/rules/prayer-coverage-gap.ts`
- Test: `tests/ansari/prayer-coverage-gap.test.ts`

- [ ] **Step 1: Create the shared mock-context helper**

```typescript
// tests/ansari/helpers.ts
import { vi } from 'vitest'

import type { NudgeContext } from '@/ansari/types'

export type PayloadMock = {
  find: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
}

export function makePayload(over: Partial<PayloadMock> = {}): PayloadMock {
  return {
    find: over.find ?? vi.fn(async () => ({ docs: [], totalDocs: 0 })),
    findByID: over.findByID ?? vi.fn(async () => null),
    update: over.update ?? vi.fn(async (a: { data: unknown }) => a.data),
    create: over.create ?? vi.fn(async (a: { data: object }) => ({ id: 1, ...a.data })),
  }
}

export function makeCtx(
  payload: PayloadMock,
  opts: { now?: string; timezone?: string } = {},
): NudgeContext {
  return {
    payload: payload as never,
    tenant: { id: 7, timezone: opts.timezone ?? 'America/Chicago' },
    now: new Date(opts.now ?? '2026-06-11T17:00:00Z'), // Thu, noon Chicago
  }
}
```

- [ ] **Step 2: Write the failing rule tests**

```typescript
// tests/ansari/prayer-coverage-gap.test.ts
import { describe, expect, it, vi } from 'vitest'

import { prayerCoverageGap } from '@/ansari/rules/prayer-coverage-gap'
import { makeCtx, makePayload } from './helpers'

const scheduleEnding = (endDate: string) => ({
  docs: [{ id: 42, endDate }],
  totalDocs: 1,
})

describe('prayer.coverage_gap', () => {
  it('fires when the latest schedule ends within 7 days', async () => {
    const payload = makePayload({
      find: vi.fn(async () => scheduleEnding('2026-06-15T00:00:00.000Z')), // 4 days out
    })
    const findings = await prayerCoverageGap.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('coverage:2026-06')
    expect(findings[0].action).toMatchObject({
      kind: 'direct',
      op: 'extendSchedule',
      params: { scheduleId: 42, newEndDate: '2026-07-31' },
    })
  })

  it('stays silent when coverage extends beyond 7 days', async () => {
    const payload = makePayload({
      find: vi.fn(async () => scheduleEnding('2026-08-01T00:00:00.000Z')),
    })
    expect(await prayerCoverageGap.evaluate(makeCtx(payload))).toEqual([])
  })

  it('stays silent when there is no schedule at all (nothing to extend)', async () => {
    const payload = makePayload()
    expect(await prayerCoverageGap.evaluate(makeCtx(payload))).toEqual([])
  })

  it('execute updates the schedule endDate (regeneration runs via existing hooks)', async () => {
    const payload = makePayload()
    const ctx = makeCtx(payload)
    const [finding] = await (async () => {
      payload.find = vi.fn(async () => scheduleEnding('2026-06-15T00:00:00.000Z'))
      return prayerCoverageGap.evaluate(ctx)
    })()
    await prayerCoverageGap.execute!(ctx, finding)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'prayer-schedules',
        id: 42,
        data: { endDate: '2026-07-31T12:00:00.000Z' },
      }),
    )
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/ansari/prayer-coverage-gap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the rule**

```typescript
// src/ansari/rules/prayer-coverage-gap.ts
import { addDays, endOfNextMonthISO, localDateISO } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

const LEAD_DAYS = 7

export const prayerCoverageGap: Rule = {
  id: 'prayer.coverage_gap',
  category: 'prayer',
  tier: 'immediate',
  requiredScope: 'prayer-times:write',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const res = await payload.find({
      collection: 'prayer-schedules',
      where: { tenant: { equals: tenant.id } },
      sort: '-endDate',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const latest = res.docs[0] as { id: string | number; endDate?: string | null } | undefined
    if (!latest?.endDate) return []

    const end = new Date(latest.endDate)
    if (end.getTime() >= addDays(now, LEAD_DAYS).getTime()) return []

    const uncoveredFrom = localDateISO(addDays(end, 1), tenant.timezone)
    const newEndDate = endOfNextMonthISO(end, tenant.timezone)
    return [
      {
        dedupKey: `coverage:${uncoveredFrom.slice(0, 7)}`,
        intent: {
          rule: 'prayer.coverage_gap',
          coveredThrough: latest.endDate,
          uncoveredFrom,
        },
        action: {
          kind: 'direct',
          op: 'extendSchedule',
          params: { scheduleId: latest.id, newEndDate },
          summary: `Extend the prayer schedule through ${newEndDate}`,
        },
      },
    ]
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('coverage_gap action must be direct')
    const { scheduleId, newEndDate } = finding.action.params as {
      scheduleId: string | number
      newEndDate: string
    }
    // payload.update runs collection hooks → autoRegeneratePrayerDays fills days[]
    await ctx.payload.update({
      collection: 'prayer-schedules',
      id: scheduleId,
      data: { endDate: `${newEndDate}T12:00:00.000Z` },
      overrideAccess: true,
    })
    return { ok: true, detail: `Schedule extended through ${newEndDate}` }
  },
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/ansari/prayer-coverage-gap.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/ansari/helpers.ts src/ansari/rules/prayer-coverage-gap.ts tests/ansari/prayer-coverage-gap.test.ts
git commit -m "feat(ansari): prayer.coverage_gap nudge rule"
```

---

### Task 7: Rule `prayer.iqamah_drift`

**Files:**
- Create: `src/ansari/rules/prayer-iqamah-drift.ts`
- Test: `tests/ansari/prayer-iqamah-drift.test.ts`

Background: in absolute mode the stored iqamah is constant while the adhan moves daily, so the adhan→iqamah gap drifts. `days[].date` values are full ISO datetimes (`generateDays` stores `date.toISOString()`); compare with `.slice(0, 10)`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/prayer-iqamah-drift.test.ts
import { describe, expect, it, vi } from 'vitest'

import { prayerIqamahDrift } from '@/ansari/rules/prayer-iqamah-drift'
import { makeCtx, makePayload } from './helpers'

// Build a schedule whose fajr adhan advances `advanceMinPerDay` minutes per day
// from a base of 5:00 AM, with a fixed absolute fajr iqamah.
function schedule(opts: {
  absolute: string
  gapAtCreation?: number | null
  advanceMinPerDay?: number
  daysCount?: number
}) {
  const { absolute, gapAtCreation = null, advanceMinPerDay = 0, daysCount = 20 } = opts
  const days = Array.from({ length: daysCount }, (_, i) => {
    const totalMin = 5 * 60 + i * advanceMinPerDay // base 5:00 AM
    const h24 = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12
    const adhan = `${h12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`
    const date = new Date(Date.UTC(2026, 5, 11 + i)).toISOString() // 2026-06-11 + i
    return {
      date,
      fajr: { adhan, iqamah: absolute },
      zuhr: { adhan: '1:30 PM', iqamah: '1:45 PM' },
      asr: { adhan: '5:00 PM', iqamah: '5:15 PM' },
      maghrib: { adhan: '8:30 PM', iqamah: '8:35 PM' },
      isha: { adhan: '10:00 PM', iqamah: '10:15 PM' },
    }
  })
  return {
    docs: [
      {
        id: 9,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-07-15T00:00:00.000Z',
        iqamahRules: {
          fajr: { mode: 'absolute', absoluteValue: absolute, gapAtCreation },
          zuhr: { mode: 'offset', offsetMinutes: 15 },
          asr: { mode: 'offset', offsetMinutes: 15 },
          maghrib: { mode: 'offset', offsetMinutes: 5 },
          isha: { mode: 'offset', offsetMinutes: 15 },
        },
        days,
      },
    ],
    totalDocs: 1,
  }
}

describe('prayer.iqamah_drift', () => {
  it('fires a floor breach when iqamah falls within 5 min of adhan inside 14 days', async () => {
    // adhan starts 5:00 AM advancing 3 min/day; iqamah fixed 5:10 AM, intended gap 10.
    // Day 2: adhan 5:06 → gap 4 (< 5) → floor breach fires BEFORE the ±10 drift
    // tolerance would (day 4) — intended gap must be small for floor to win.
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:10 AM', gapAtCreation: 10, advanceMinPerDay: 3 })),
    })
    const findings = await prayerIqamahDrift.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('iqamah:fajr:floor')
    expect(findings[0].intent).toMatchObject({ prayer: 'fajr', breach: 'floor' })
    // proposed = breach-day adhan + intended gap (>= floor)
    expect(findings[0].action).toMatchObject({ kind: 'direct', op: 'setAbsoluteIqamah' })
  })

  it('fires a drift breach when the gap strays more than ±10 min from gapAtCreation', async () => {
    // base 5:00 + 2/day, iqamah 5:45, intended 45 → day i gap = 45 − 2i;
    // day 6: gap 33, |33 − 45| = 12 > 10 → drift (still ≥ 5, so not floor)
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:45 AM', gapAtCreation: 45, advanceMinPerDay: 2 })),
    })
    const findings = await prayerIqamahDrift.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('iqamah:fajr:drift')
  })

  it('falls back to the first lookahead day gap when no snapshot exists', async () => {
    // No gapAtCreation: intended = day-0 gap. Constant adhan → no drift, no floor → silent.
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:45 AM', gapAtCreation: null, advanceMinPerDay: 0 })),
    })
    expect(await prayerIqamahDrift.evaluate(makeCtx(payload))).toEqual([])
  })

  it('ignores offset-mode prayers entirely', async () => {
    const payload = makePayload({
      find: vi.fn(async () => schedule({ absolute: '5:45 AM', gapAtCreation: 45, advanceMinPerDay: 0 })),
    })
    const findings = await prayerIqamahDrift.evaluate(makeCtx(payload))
    expect(findings.every((f) => (f.intent as { prayer?: string }).prayer === 'fajr')).toBe(true)
  })

  it('execute rewrites the absolute value via iqamahRules update', async () => {
    const sched = schedule({ absolute: '5:20 AM', gapAtCreation: 20, advanceMinPerDay: 3 })
    const payload = makePayload({
      find: vi.fn(async () => sched),
      findByID: vi.fn(async () => sched.docs[0]),
    })
    const ctx = makeCtx(payload)
    const [finding] = await prayerIqamahDrift.evaluate(ctx)
    await prayerIqamahDrift.execute!(ctx, finding)
    const call = payload.update.mock.calls[0][0]
    expect(call.collection).toBe('prayer-schedules')
    expect(call.id).toBe(9)
    expect(call.data.iqamahRules.fajr.mode).toBe('absolute')
    expect(call.data.iqamahRules.fajr.absoluteValue).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/prayer-iqamah-drift.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the rule**

```typescript
// src/ansari/rules/prayer-iqamah-drift.ts
import { formatTime, parseTime } from '@/lib/iqamah'
import { addDays, localDateISO } from '@/ansari/time'
import type { Finding, NudgeContext, Rule } from '@/ansari/types'

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const
const FLOOR_MIN = 5
const TOLERANCE_MIN = 10
const LOOKAHEAD_DAYS = 14

type DayRow = { date?: string | null } & Record<string, unknown>
type RuleShape = { mode?: string; absoluteValue?: string | null; gapAtCreation?: number | null }
type ScheduleDoc = {
  id: string | number
  iqamahRules?: Record<string, RuleShape>
  days?: DayRow[]
}

async function activeSchedule(ctx: NudgeContext): Promise<ScheduleDoc | null> {
  const { payload, tenant, now } = ctx
  const dayFloor = `${localDateISO(now, tenant.timezone)}T00:00:00.000Z`
  const res = await payload.find({
    collection: 'prayer-schedules',
    where: {
      tenant: { equals: tenant.id },
      startDate: { less_than_equal: now.toISOString() },
      endDate: { greater_than_equal: dayFloor },
    },
    sort: '-startDate',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs[0] as ScheduleDoc) ?? null
}

function prayerGap(day: DayRow, prayer: string): number | null {
  const cell = day[prayer] as { adhan?: string | null; iqamah?: string | null } | undefined
  const adhan = parseTime(cell?.adhan ?? '')
  const iqamah = parseTime(cell?.iqamah ?? '')
  if (adhan == null || iqamah == null) return null
  return iqamah - adhan
}

export const prayerIqamahDrift: Rule = {
  id: 'prayer.iqamah_drift',
  category: 'prayer',
  tier: 'immediate',
  requiredScope: 'prayer-times:write',

  async evaluate(ctx) {
    const { tenant, now } = ctx
    const schedule = await activeSchedule(ctx)
    if (!schedule) return []

    const todayKey = localDateISO(now, tenant.timezone)
    const horizonKey = localDateISO(addDays(now, LOOKAHEAD_DAYS), tenant.timezone)
    const windowDays = (schedule.days ?? []).filter((d) => {
      const key = typeof d.date === 'string' ? d.date.slice(0, 10) : ''
      return key >= todayKey && key <= horizonKey
    })
    if (windowDays.length === 0) return []

    const findings: Finding[] = []
    for (const prayer of PRAYERS) {
      const rule = schedule.iqamahRules?.[prayer]
      if (rule?.mode !== 'absolute' || !rule.absoluteValue) continue

      // Intended gap: the snapshot if present, else the gap on the first
      // lookahead day (pure fallback for pre-snapshot rules — see spec).
      const intendedGap = rule.gapAtCreation ?? prayerGap(windowDays[0], prayer)
      if (intendedGap == null) continue

      for (const d of windowDays) {
        const gap = prayerGap(d, prayer)
        if (gap == null) continue
        const breach = gap < FLOOR_MIN ? 'floor' : Math.abs(gap - intendedGap) > TOLERANCE_MIN ? 'drift' : null
        if (!breach) continue

        const adhanThatDay = (d[prayer] as { adhan?: string }).adhan ?? ''
        const proposed = formatTime((parseTime(adhanThatDay) ?? 0) + Math.max(intendedGap, FLOOR_MIN))
        findings.push({
          dedupKey: `iqamah:${prayer}:${breach}`,
          intent: {
            rule: 'prayer.iqamah_drift',
            prayer,
            breach,
            firstBreachDate: typeof d.date === 'string' ? d.date.slice(0, 10) : null,
            currentIqamah: rule.absoluteValue,
            gapMinutes: gap,
            intendedGapMinutes: intendedGap,
          },
          action: {
            kind: 'direct',
            op: 'setAbsoluteIqamah',
            params: { scheduleId: schedule.id, prayer, value: proposed },
            summary: `Move ${prayer} iqamah to ${proposed} (restores the ${intendedGap}-min gap)`,
          },
        })
        break // earliest breach per prayer only
      }
    }
    return findings
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('iqamah_drift action must be direct')
    const { scheduleId, prayer, value } = finding.action.params as {
      scheduleId: string | number
      prayer: string
      value: string
    }
    const doc = (await ctx.payload.findByID({
      collection: 'prayer-schedules',
      id: scheduleId,
      depth: 0,
      overrideAccess: true,
    })) as ScheduleDoc
    const rules = { ...(doc.iqamahRules ?? {}) }
    rules[prayer] = { ...rules[prayer], mode: 'absolute', absoluteValue: value }
    // Hooks re-apply rules to days[] and re-snapshot gapAtCreation.
    await ctx.payload.update({
      collection: 'prayer-schedules',
      id: scheduleId,
      data: { iqamahRules: rules },
      overrideAccess: true,
    })
    return { ok: true, detail: `${prayer} iqamah moved to ${value}` }
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/ansari/prayer-iqamah-drift.test.ts`
Expected: PASS. (If the drift fixture math is off by a day, recompute: gap on day i = parse(absolute) − (300 + i·advance). The assertions only pin dedupKey/breach type, not the day.)

- [ ] **Step 5: Commit**

```bash
git add src/ansari/rules/prayer-iqamah-drift.ts tests/ansari/prayer-iqamah-drift.test.ts
git commit -m "feat(ansari): prayer.iqamah_drift nudge rule"
```

---

### Task 8: Rules `calendar.dst` + `calendar.ramadan`

**Files:**
- Create: `src/ansari/rules/calendar-dst.ts`
- Create: `src/ansari/rules/calendar-ramadan.ts`
- Test: `tests/ansari/calendar-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/calendar-rules.test.ts
import { describe, expect, it } from 'vitest'

import { calendarDst } from '@/ansari/rules/calendar-dst'
import { calendarRamadan } from '@/ansari/rules/calendar-ramadan'
import { makeCtx, makePayload } from './helpers'

describe('calendar.dst', () => {
  it('fires when a US fall-back transition is within 5 days', async () => {
    // US DST ends Sun 2026-11-01 (America/Chicago). Oct 28 is 4 days before.
    const ctx = makeCtx(makePayload(), { now: '2026-10-28T17:00:00Z' })
    const findings = await calendarDst.evaluate(ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('dst:2026-11-01')
    expect(findings[0].intent).toMatchObject({ direction: 'back' })
    expect(findings[0].action.kind).toBe('conversation-starter')
  })

  it('fires forward for the spring transition (2026-03-08)', async () => {
    const ctx = makeCtx(makePayload(), { now: '2026-03-04T18:00:00Z' })
    const findings = await calendarDst.evaluate(ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('dst:2026-03-08')
    expect(findings[0].intent).toMatchObject({ direction: 'forward' })
  })

  it('is silent mid-season', async () => {
    const ctx = makeCtx(makePayload(), { now: '2026-06-11T17:00:00Z' })
    expect(await calendarDst.evaluate(ctx)).toEqual([])
  })
})

describe('calendar.ramadan', () => {
  it('fires once when 1 Ramadan is within 14 days, keyed by hijri year', async () => {
    // Ramadan 1447 begins ~2026-02-17 (umalqura). Scan from Feb 10.
    const ctx = makeCtx(makePayload(), { now: '2026-02-10T18:00:00Z' })
    const findings = await calendarRamadan.evaluate(ctx)
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('ramadan:1447')
    expect(findings[0].action).toMatchObject({ kind: 'conversation-starter', topic: 'ramadan-schedule' })
  })

  it('is silent months away from Ramadan', async () => {
    const ctx = makeCtx(makePayload(), { now: '2026-06-11T17:00:00Z' })
    expect(await calendarRamadan.evaluate(ctx)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/calendar-rules.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both rules**

```typescript
// src/ansari/rules/calendar-dst.ts
import { addDays, localDateISO, tzOffsetMinutes } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

const LEAD_DAYS = 5

export const calendarDst: Rule = {
  id: 'calendar.dst',
  category: 'calendar',
  tier: 'immediate',
  requiredScope: 'prayer-times:write',

  async evaluate(ctx) {
    const { tenant, now } = ctx
    const baseOffset = tzOffsetMinutes(now, tenant.timezone)
    for (let i = 1; i <= LEAD_DAYS; i++) {
      const day = addDays(now, i)
      const offset = tzOffsetMinutes(day, tenant.timezone)
      if (offset === baseOffset) continue
      const transitionDate = localDateISO(day, tenant.timezone)
      return [
        {
          dedupKey: `dst:${transitionDate}`,
          intent: {
            rule: 'calendar.dst',
            transitionDate,
            direction: offset > baseOffset ? 'forward' : 'back',
            shiftMinutes: offset - baseOffset,
          },
          action: {
            kind: 'conversation-starter',
            topic: 'dst-review',
            summary: 'Review Fajr & Isha iqamah times around the clock change',
          },
        },
      ]
    }
    return []
  },
}
```

```typescript
// src/ansari/rules/calendar-ramadan.ts
import { addDays, hijriParts, localDateISO } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

const LEAD_DAYS = 14

export const calendarRamadan: Rule = {
  id: 'calendar.ramadan',
  category: 'calendar',
  tier: 'immediate',
  requiredScope: 'prayer-times:write',

  async evaluate(ctx) {
    const { tenant, now } = ctx
    for (let i = 0; i <= LEAD_DAYS; i++) {
      const day = addDays(now, i)
      const h = hijriParts(day, tenant.timezone)
      if (h.month !== 9 || h.day !== 1) continue
      return [
        {
          dedupKey: `ramadan:${h.year}`,
          intent: {
            rule: 'calendar.ramadan',
            startsOn: localDateISO(day, tenant.timezone),
            hijriYear: h.year,
            daysAway: i,
          },
          action: {
            kind: 'conversation-starter',
            topic: 'ramadan-schedule',
            summary: 'Set up the Ramadan prayer schedule',
          },
        },
      ]
    }
    return []
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/ansari/calendar-rules.test.ts`
Expected: PASS. If the Ramadan test fails on the exact hijri year, print `hijriParts(new Date('2026-02-17T18:00:00Z'), 'America/Chicago')` — adjust the test's `now` so 1 Ramadan falls inside the 14-day window per Node's umalqura data (the rule logic is date-data-agnostic).

- [ ] **Step 5: Commit**

```bash
git add src/ansari/rules/calendar-dst.ts src/ansari/rules/calendar-ramadan.ts tests/ansari/calendar-rules.test.ts
git commit -m "feat(ansari): calendar.dst and calendar.ramadan nudge rules"
```

---

### Task 9: Rules `forms.capacity` + `announcements.expiring`

**Files:**
- Create: `src/ansari/rules/forms-capacity.ts`
- Create: `src/ansari/rules/announcements-expiring.ts`
- Test: `tests/ansari/forms-announcements-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/forms-announcements-rules.test.ts
import { describe, expect, it, vi } from 'vitest'

import { announcementsExpiring } from '@/ansari/rules/announcements-expiring'
import { formsCapacity } from '@/ansari/rules/forms-capacity'
import { makeCtx, makePayload } from './helpers'

function formsPayload(forms: object[], countsByFormId: Record<number, number>) {
  return makePayload({
    find: vi.fn(async ({ collection, where }: { collection: string; where?: never }) => {
      if (collection === 'forms') return { docs: forms, totalDocs: forms.length }
      if (collection === 'form-submissions') {
        const formId = (where as { form?: { equals?: number } })?.form?.equals ?? -1
        return { docs: [], totalDocs: countsByFormId[formId] ?? 0 }
      }
      return { docs: [], totalDocs: 0 }
    }),
  })
}

describe('forms.capacity', () => {
  const form = (id: number, capacity: number | null) => ({
    id,
    title: `Form ${id}`,
    status: 'published',
    settings: { capacity },
  })

  it('fires "full" at 100% with a close action, "near" at 90% with a raise action', async () => {
    const payload = formsPayload([form(1, 100), form(2, 100), form(3, 100)], { 1: 100, 2: 92, 3: 50 })
    const findings = await formsCapacity.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(2)
    const full = findings.find((f) => f.dedupKey === 'formcap:1:full')!
    expect(full.action).toMatchObject({ kind: 'direct', op: 'closeForm', params: { formId: 1 } })
    const near = findings.find((f) => f.dedupKey === 'formcap:2:near')!
    expect(near.action).toMatchObject({
      kind: 'direct',
      op: 'raiseFormCapacity',
      params: { formId: 2, newCapacity: 125 },
    })
  })

  it('skips forms without a capacity', async () => {
    const payload = formsPayload([form(1, null)], { 1: 500 })
    expect(await formsCapacity.evaluate(makeCtx(payload))).toEqual([])
  })

  it('execute closes a form / raises capacity', async () => {
    const payload = makePayload({
      findByID: vi.fn(async () => ({ id: 2, settings: { capacity: 100, requiresPayment: false } })),
    })
    const ctx = makeCtx(payload)
    await formsCapacity.execute!(ctx, {
      dedupKey: 'formcap:1:full',
      intent: {},
      action: { kind: 'direct', op: 'closeForm', params: { formId: 1 }, summary: '' },
    })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'forms', id: 1, data: { status: 'closed' } }),
    )
    await formsCapacity.execute!(ctx, {
      dedupKey: 'formcap:2:near',
      intent: {},
      action: { kind: 'direct', op: 'raiseFormCapacity', params: { formId: 2, newCapacity: 125 }, summary: '' },
    })
    const raise = payload.update.mock.calls[1][0]
    expect(raise.data.settings).toMatchObject({ capacity: 125, requiresPayment: false }) // preserves siblings
  })
})

describe('announcements.expiring', () => {
  it('fires for active announcements expiring within 24h, keyed by id+expiry', async () => {
    const expiresAt = '2026-06-12T03:00:00.000Z' // 10h after fixture now
    const payload = makePayload({
      find: vi.fn(async () => ({
        docs: [{ id: 5, title: 'Jumu’ah moved', expiresAt }],
        totalDocs: 1,
      })),
    })
    const findings = await announcementsExpiring.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe(`ann:5:${expiresAt}`)
    expect(findings[0].action).toMatchObject({
      kind: 'direct',
      op: 'extendAnnouncement',
      params: { announcementId: 5, newExpiresAt: '2026-06-19T03:00:00.000Z' },
    })
  })

  it('execute pushes the expiry out', async () => {
    const payload = makePayload()
    await announcementsExpiring.execute!(makeCtx(payload), {
      dedupKey: 'ann:5:x',
      intent: {},
      action: {
        kind: 'direct',
        op: 'extendAnnouncement',
        params: { announcementId: 5, newExpiresAt: '2026-06-19T03:00:00.000Z' },
        summary: '',
      },
    })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'announcements',
        id: 5,
        data: { expiresAt: '2026-06-19T03:00:00.000Z' },
      }),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/forms-announcements-rules.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both rules**

```typescript
// src/ansari/rules/forms-capacity.ts
import type { Finding, Rule } from '@/ansari/types'

const NEAR_RATIO = 0.9
const RAISE_RATIO = 1.25

export const formsCapacity: Rule = {
  id: 'forms.capacity',
  category: 'forms',
  tier: 'immediate',
  requiredScope: 'forms:write',

  async evaluate(ctx) {
    const { payload, tenant } = ctx
    const forms = await payload.find({
      collection: 'forms',
      where: { tenant: { equals: tenant.id }, status: { equals: 'published' } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })

    const findings: Finding[] = []
    for (const doc of forms.docs as Array<{
      id: string | number
      title?: string
      settings?: { capacity?: number | null }
    }>) {
      const capacity = doc.settings?.capacity
      if (!capacity || capacity <= 0) continue

      const count = (
        await payload.find({
          collection: 'form-submissions',
          where: { form: { equals: doc.id } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      ).totalDocs

      const base = {
        rule: 'forms.capacity',
        formId: doc.id,
        title: doc.title ?? '',
        capacity,
        submissionCount: count,
      }
      if (count >= capacity) {
        findings.push({
          dedupKey: `formcap:${doc.id}:full`,
          intent: { ...base, level: 'full' },
          action: {
            kind: 'direct',
            op: 'closeForm',
            params: { formId: doc.id },
            summary: `Close "${doc.title ?? 'the form'}" — it is full (${count}/${capacity})`,
          },
        })
      } else if (count >= Math.ceil(capacity * NEAR_RATIO)) {
        const newCapacity = Math.ceil(capacity * RAISE_RATIO)
        findings.push({
          dedupKey: `formcap:${doc.id}:near`,
          intent: { ...base, level: 'near' },
          action: {
            kind: 'direct',
            op: 'raiseFormCapacity',
            params: { formId: doc.id, newCapacity },
            summary: `Raise "${doc.title ?? 'the form'}" capacity to ${newCapacity} (${count}/${capacity} filled)`,
          },
        })
      }
    }
    return findings
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('forms.capacity action must be direct')
    const { op, params } = finding.action
    if (op === 'closeForm') {
      const { formId } = params as { formId: string | number }
      await ctx.payload.update({
        collection: 'forms',
        id: formId,
        data: { status: 'closed' },
        overrideAccess: true,
      })
      return { ok: true, detail: 'Form closed' }
    }
    if (op === 'raiseFormCapacity') {
      const { formId, newCapacity } = params as { formId: string | number; newCapacity: number }
      const doc = (await ctx.payload.findByID({
        collection: 'forms',
        id: formId,
        depth: 0,
        overrideAccess: true,
      })) as { settings?: Record<string, unknown> }
      await ctx.payload.update({
        collection: 'forms',
        id: formId,
        data: { settings: { ...(doc.settings ?? {}), capacity: newCapacity } },
        overrideAccess: true,
      })
      return { ok: true, detail: `Capacity raised to ${newCapacity}` }
    }
    throw new Error(`Unknown forms.capacity op: ${op}`)
  },
}
```

```typescript
// src/ansari/rules/announcements-expiring.ts
import { addDays } from '@/ansari/time'
import type { Finding, Rule } from '@/ansari/types'

const EXTEND_DAYS = 7

export const announcementsExpiring: Rule = {
  id: 'announcements.expiring',
  category: 'announcements',
  tier: 'immediate',
  requiredScope: 'announcements:write',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const res = await payload.find({
      collection: 'announcements',
      where: {
        tenant: { equals: tenant.id },
        active: { equals: true },
        expiresAt: { greater_than: now.toISOString(), less_than_equal: addDays(now, 1).toISOString() },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const findings: Finding[] = []
    for (const doc of res.docs as Array<{ id: string | number; title?: string; expiresAt?: string }>) {
      if (!doc.expiresAt) continue
      const newExpiresAt = addDays(new Date(doc.expiresAt), EXTEND_DAYS).toISOString()
      findings.push({
        dedupKey: `ann:${doc.id}:${doc.expiresAt}`,
        intent: {
          rule: 'announcements.expiring',
          announcementId: doc.id,
          title: doc.title ?? '',
          expiresAt: doc.expiresAt,
        },
        action: {
          kind: 'direct',
          op: 'extendAnnouncement',
          params: { announcementId: doc.id, newExpiresAt },
          summary: `Keep "${doc.title ?? 'the announcement'}" up for another week`,
        },
      })
    }
    return findings
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('announcements.expiring action must be direct')
    const { announcementId, newExpiresAt } = finding.action.params as {
      announcementId: string | number
      newExpiresAt: string
    }
    await ctx.payload.update({
      collection: 'announcements',
      id: announcementId,
      data: { expiresAt: newExpiresAt },
      overrideAccess: true,
    })
    return { ok: true, detail: `Extended through ${newExpiresAt.slice(0, 10)}` }
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/ansari/forms-announcements-rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ansari/rules/forms-capacity.ts src/ansari/rules/announcements-expiring.ts tests/ansari/forms-announcements-rules.test.ts
git commit -m "feat(ansari): forms.capacity and announcements.expiring nudge rules"
```

---

### Task 10: Rules `events.low_rsvp` + `events.missing_flyer`

**Files:**
- Create: `src/ansari/rules/events-low-rsvp.ts`
- Create: `src/ansari/rules/events-missing-flyer.ts`
- Test: `tests/ansari/events-rules.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/events-rules.test.ts
import { describe, expect, it, vi } from 'vitest'

import { eventsLowRsvp } from '@/ansari/rules/events-low-rsvp'
import { eventsMissingFlyer } from '@/ansari/rules/events-missing-flyer'
import { makeCtx, makePayload } from './helpers'

const NOW = '2026-06-11T17:00:00Z'

describe('events.low_rsvp', () => {
  function payloadFor(events: object[], formCapacity: number | null, submissions: number) {
    return makePayload({
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'events') return { docs: events, totalDocs: events.length }
        if (collection === 'form-submissions') return { docs: [], totalDocs: submissions }
        return { docs: [], totalDocs: 0 }
      }),
      findByID: vi.fn(async () => ({ id: 30, settings: { capacity: formCapacity } })),
    })
  }
  const event = (signupForm: number | null) => ({
    id: 11,
    title: 'Eid Dinner',
    startDate: '2026-06-13T23:00:00.000Z', // ~2 days out
    tenant: 7,
    signupForm,
  })

  it('fires when RSVPs are under 25% of the linked form capacity', async () => {
    const payload = payloadFor([event(30)], 100, 20)
    const findings = await eventsLowRsvp.evaluate(makeCtx(payload, { now: NOW }))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('rsvp:11')
    expect(findings[0].intent).toMatchObject({ rsvpCount: 20, capacity: 100 })
    expect(findings[0].action).toMatchObject({ kind: 'direct', op: 'postReminderAnnouncement' })
  })

  it('uses the <10 fallback when the form has no capacity', async () => {
    expect(await eventsLowRsvp.evaluate(makeCtx(payloadFor([event(30)], null, 9), { now: NOW }))).toHaveLength(1)
    expect(await eventsLowRsvp.evaluate(makeCtx(payloadFor([event(30)], null, 12), { now: NOW }))).toEqual([])
  })

  it('skips events without a linked signup form', async () => {
    expect(await eventsLowRsvp.evaluate(makeCtx(payloadFor([event(null)], 100, 0), { now: NOW }))).toEqual([])
  })

  it('execute posts a reminder announcement expiring at the event start', async () => {
    const payload = makePayload({
      findByID: vi.fn(async () => ({ id: 11, title: 'Eid Dinner', startDate: '2026-06-13T23:00:00.000Z', tenant: 7 })),
    })
    await eventsLowRsvp.execute!(makeCtx(payload, { now: NOW }), {
      dedupKey: 'rsvp:11',
      intent: {},
      action: { kind: 'direct', op: 'postReminderAnnouncement', params: { eventId: 11 }, summary: '' },
    })
    const call = payload.create.mock.calls[0][0]
    expect(call.collection).toBe('announcements')
    expect(call.data).toMatchObject({ tenant: 7, active: true, expiresAt: '2026-06-13T23:00:00.000Z' })
    expect(call.data.title).toContain('Eid Dinner')
  })
})

describe('events.missing_flyer', () => {
  it('fires for events within 7 days that have no flyer image', async () => {
    const payload = makePayload({
      find: vi.fn(async () => ({
        docs: [
          { id: 21, title: 'Halaqa', startDate: '2026-06-15T00:00:00.000Z', flyerImage: null },
          { id: 22, title: 'Fundraiser', startDate: '2026-06-16T00:00:00.000Z', flyerImage: 99 },
        ],
        totalDocs: 2,
      })),
    })
    const findings = await eventsMissingFlyer.evaluate(makeCtx(payload, { now: NOW }))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('flyer:21')
    expect(findings[0].action).toMatchObject({ kind: 'conversation-starter', topic: 'generate-flyer' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/events-rules.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both rules**

```typescript
// src/ansari/rules/events-low-rsvp.ts
import { addDays, localDateISO } from '@/ansari/time'
import type { Finding, Rule } from '@/ansari/types'

const LEAD_DAYS = 3
const LOW_RATIO = 0.25
const LOW_ABSOLUTE = 10 // uncapped forms

function extractId(rel: unknown): string | number | null {
  if (rel == null) return null
  if (typeof rel === 'object' && 'id' in rel) return (rel as { id: string | number }).id
  return rel as string | number
}

export const eventsLowRsvp: Rule = {
  id: 'events.low_rsvp',
  category: 'events',
  tier: 'digest',
  requiredScope: 'announcements:write',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const events = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
        startDate: { greater_than: now.toISOString(), less_than_equal: addDays(now, LEAD_DAYS).toISOString() },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const findings: Finding[] = []
    for (const doc of events.docs as Array<{
      id: string | number
      title?: string
      startDate?: string
      signupForm?: unknown
    }>) {
      const formId = extractId(doc.signupForm)
      if (!formId) continue // no path from event → RSVP count without the link

      let capacity: number | null = null
      try {
        const form = (await payload.findByID({
          collection: 'forms',
          id: formId,
          depth: 0,
          overrideAccess: true,
        })) as { settings?: { capacity?: number | null } }
        capacity = form.settings?.capacity ?? null
      } catch {
        continue
      }

      const count = (
        await payload.find({
          collection: 'form-submissions',
          where: { form: { equals: formId } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      ).totalDocs

      const low = capacity && capacity > 0 ? count < capacity * LOW_RATIO : count < LOW_ABSOLUTE
      if (!low) continue

      findings.push({
        dedupKey: `rsvp:${doc.id}`,
        intent: {
          rule: 'events.low_rsvp',
          eventId: doc.id,
          title: doc.title ?? '',
          startDate: doc.startDate ?? null,
          rsvpCount: count,
          capacity,
        },
        action: {
          kind: 'direct',
          op: 'postReminderAnnouncement',
          params: { eventId: doc.id },
          summary: `Post a reminder announcement for "${doc.title ?? 'the event'}"`,
        },
      })
    }
    return findings
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('events.low_rsvp action must be direct')
    const { eventId } = finding.action.params as { eventId: string | number }
    const event = (await ctx.payload.findByID({
      collection: 'events',
      id: eventId,
      depth: 0,
      overrideAccess: true,
    })) as { title?: string; startDate?: string; tenant?: unknown }
    const when = event.startDate
      ? ` — ${localDateISO(new Date(event.startDate), ctx.tenant.timezone)}`
      : ''
    await ctx.payload.create({
      collection: 'announcements',
      data: {
        tenant: extractId(event.tenant) ?? ctx.tenant.id,
        title: `Reminder: ${event.title ?? 'Upcoming event'}${when}`,
        active: true,
        priority: 'normal',
        ...(event.startDate ? { expiresAt: event.startDate } : {}),
      },
      overrideAccess: true,
    })
    return { ok: true, detail: 'Reminder announcement posted' }
  },
}
```

```typescript
// src/ansari/rules/events-missing-flyer.ts
import { addDays } from '@/ansari/time'
import type { Finding, Rule } from '@/ansari/types'

const LEAD_DAYS = 7

export const eventsMissingFlyer: Rule = {
  id: 'events.missing_flyer',
  category: 'events',
  tier: 'digest',
  requiredScope: 'events:write',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const events = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
        startDate: { greater_than: now.toISOString(), less_than_equal: addDays(now, LEAD_DAYS).toISOString() },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const findings: Finding[] = []
    for (const doc of events.docs as Array<{
      id: string | number
      title?: string
      startDate?: string
      flyerImage?: unknown
    }>) {
      if (doc.flyerImage) continue
      findings.push({
        dedupKey: `flyer:${doc.id}`,
        intent: {
          rule: 'events.missing_flyer',
          eventId: doc.id,
          title: doc.title ?? '',
          startDate: doc.startDate ?? null,
        },
        action: {
          kind: 'conversation-starter',
          topic: 'generate-flyer',
          summary: `Generate a flyer for "${doc.title ?? 'the event'}"`,
        },
      })
    }
    return findings
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/ansari/events-rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ansari/rules/events-low-rsvp.ts src/ansari/rules/events-missing-flyer.ts tests/ansari/events-rules.test.ts
git commit -m "feat(ansari): events.low_rsvp and events.missing_flyer nudge rules"
```

---

### Task 11: Rule `digest.weekly` + the registry

**Files:**
- Create: `src/ansari/rules/digest-weekly.ts`
- Create: `src/ansari/registry.ts`
- Test: `tests/ansari/digest-weekly.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/digest-weekly.test.ts
import { describe, expect, it, vi } from 'vitest'

import { RULES, ruleById } from '@/ansari/registry'
import { digestWeekly } from '@/ansari/rules/digest-weekly'
import { RULE_IDS } from '@/ansari/ruleIds'
import { makeCtx, makePayload } from './helpers'

describe('digest.weekly', () => {
  it('rolls up member stats, upcoming events, and unresolved immediates', async () => {
    const payload = makePayload({
      find: vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
        if (collection === 'members') {
          const isNewQuery = JSON.stringify(where).includes('createdAt')
          return { docs: [], totalDocs: isNewQuery ? 4 : 120 }
        }
        if (collection === 'events') {
          return {
            docs: [{ id: 1, title: 'Halaqa', startDate: '2026-06-15T00:00:00.000Z', flyerImage: null }],
            totalDocs: 1,
          }
        }
        if (collection === 'nudge-states') {
          return {
            docs: [{ id: 50, rule: 'prayer.coverage_gap', status: 'delivered', intent: { rule: 'prayer.coverage_gap' } }],
            totalDocs: 1,
          }
        }
        return { docs: [], totalDocs: 0 }
      }),
    })
    const findings = await digestWeekly.evaluate(makeCtx(payload)) // 2026-06-11 → ISO week 24
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('digest:2026-W24')
    expect(findings[0].intent).toMatchObject({
      stats: { membersTotal: 120, membersNewThisMonth: 4 },
    })
    expect((findings[0].intent.upcomingEvents as unknown[]).length).toBe(1)
    expect((findings[0].intent.unresolved as unknown[]).length).toBe(1)
    expect(findings[0].action.kind).toBe('conversation-starter')
  })
})

describe('registry', () => {
  it('contains every rule id exactly once', () => {
    expect(RULES.map((r) => r.id).sort()).toEqual([...RULE_IDS].sort())
    expect(ruleById('prayer.coverage_gap')?.tier).toBe('immediate')
    expect(ruleById('nope')).toBeUndefined()
  })

  it('direct-action rules all have execute()', () => {
    for (const id of ['prayer.coverage_gap', 'prayer.iqamah_drift', 'forms.capacity', 'announcements.expiring', 'events.low_rsvp']) {
      expect(ruleById(id)?.execute, id).toBeTypeOf('function')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/digest-weekly.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the digest rule and registry**

```typescript
// src/ansari/rules/digest-weekly.ts
import { addDays, isoWeekKey, localParts } from '@/ansari/time'
import type { Rule } from '@/ansari/types'

export const digestWeekly: Rule = {
  id: 'digest.weekly',
  category: 'digest',
  tier: 'digest',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const week = isoWeekKey(now, tenant.timezone)
    const p = localParts(now, tenant.timezone)
    const monthStartUTC = `${p.year}-${String(p.month).padStart(2, '0')}-01T00:00:00.000Z`

    const membersTotal = (
      await payload.find({
        collection: 'members',
        where: { tenant: { equals: tenant.id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).totalDocs

    const membersNewThisMonth = (
      await payload.find({
        collection: 'members',
        where: { tenant: { equals: tenant.id }, createdAt: { greater_than_equal: monthStartUTC } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).totalDocs

    const eventsRes = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
        startDate: { greater_than: now.toISOString(), less_than_equal: addDays(now, 7).toISOString() },
      },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    const upcomingEvents = (eventsRes.docs as Array<{ title?: string; startDate?: string; flyerImage?: unknown }>).map(
      (e) => ({ title: e.title ?? '', startDate: e.startDate ?? null, hasFlyer: Boolean(e.flyerImage) }),
    )

    // The safety net: unresolved immediate-tier items resurface here.
    const unresolvedRes = await payload.find({
      collection: 'nudge-states',
      where: {
        tenant: { equals: tenant.id },
        tier: { equals: 'immediate' },
        status: { in: ['emitted', 'delivered', 'snoozed'] },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    const unresolved = (unresolvedRes.docs as Array<{ id: string | number; rule: string; status: string; intent?: unknown }>).map(
      (s) => ({ id: s.id, rule: s.rule, status: s.status, intent: s.intent ?? null }),
    )

    return [
      {
        dedupKey: `digest:${week}`,
        // Exact figures travel in the intent — Hermes templates them verbatim,
        // the LLM writes only connective prose (hard guard, see spec).
        intent: {
          rule: 'digest.weekly',
          week,
          stats: { membersTotal, membersNewThisMonth },
          upcomingEvents,
          unresolved,
        },
        action: {
          kind: 'conversation-starter',
          topic: 'weekly-digest',
          summary: 'Want me to handle any of it?',
        },
      },
    ]
  },
}
```

```typescript
// src/ansari/registry.ts
import { announcementsExpiring } from './rules/announcements-expiring'
import { calendarDst } from './rules/calendar-dst'
import { calendarRamadan } from './rules/calendar-ramadan'
import { digestWeekly } from './rules/digest-weekly'
import { eventsLowRsvp } from './rules/events-low-rsvp'
import { eventsMissingFlyer } from './rules/events-missing-flyer'
import { formsCapacity } from './rules/forms-capacity'
import { prayerCoverageGap } from './rules/prayer-coverage-gap'
import { prayerIqamahDrift } from './rules/prayer-iqamah-drift'
import type { Rule } from './types'

export const RULES: Rule[] = [
  prayerCoverageGap,
  prayerIqamahDrift,
  calendarDst,
  calendarRamadan,
  formsCapacity,
  announcementsExpiring,
  eventsLowRsvp,
  eventsMissingFlyer,
  digestWeekly,
]

export function ruleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/ansari/digest-weekly.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ansari/rules/digest-weekly.ts src/ansari/registry.ts tests/ansari/digest-weekly.test.ts
git commit -m "feat(ansari): weekly digest rule and rule registry"
```

---

### Task 12: The pipeline — `src/ansari/pipeline.ts`

**Files:**
- Create: `src/ansari/pipeline.ts`
- Test: `tests/ansari/pipeline.test.ts`

Semantics (from the spec): emitted-not-acked re-emits every poll (at-least-once); delivered & unresolved stays silent; quiet hours **hold** immediates (no NudgeState written); digest tier passes only in the digest window (`weekday === digestDay && hour >= digestHour`); snoozed items surface only via digest content; the resolution sweep marks states whose dedupKey no longer fires as `resolved`; old-week digest states resolve automatically; `digest.weekly` evaluates **after** the sweep so its "unresolved" list is fresh.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/pipeline.test.ts
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_SETTINGS, inDigestWindow, inQuietHours, runNudgePipeline } from '@/ansari/pipeline'

const CHI = 'America/Chicago'
// Thursday 2026-06-11 12:00 Chicago — inside allowed hours, not a digest window
const NOON = new Date('2026-06-11T17:00:00Z')
// Thursday 2026-06-11 23:00 Chicago — inside quiet hours (21→8)
const NIGHT = new Date('2026-06-12T04:00:00Z')
// Sunday 2026-06-14 10:00 Chicago — digest window (Sunday, hour >= 9)
const SUNDAY = new Date('2026-06-14T15:00:00Z')

function db(opts: {
  schedules?: object[]
  states?: object[]
  settings?: object[]
} = {}) {
  const created: Record<string, unknown>[] = []
  const updated: Array<{ id: unknown; data: Record<string, unknown> }> = []
  let nextId = 100
  const payload = {
    findByID: vi.fn(async () => ({ id: 7, location: { timezone: CHI } })),
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'ansari-settings') return { docs: opts.settings ?? [], totalDocs: 0 }
      if (collection === 'prayer-schedules') return { docs: opts.schedules ?? [], totalDocs: 0 }
      if (collection === 'nudge-states') return { docs: opts.states ?? [], totalDocs: (opts.states ?? []).length }
      return { docs: [], totalDocs: 0 }
    }),
    create: vi.fn(async (a: { data: Record<string, unknown> }) => {
      const doc = { id: nextId++, ...a.data }
      created.push(doc)
      return doc
    }),
    update: vi.fn(async (a: { id: unknown; data: Record<string, unknown> }) => {
      updated.push(a)
      return a.data
    }),
  }
  return { payload: payload as never, created, updated }
}

// One real firing rule is enough to exercise the machinery: a schedule ending
// in 4 days makes prayer.coverage_gap fire with dedupKey 'coverage:2026-06'.
const FIRING_SCHEDULE = [{ id: 42, endDate: '2026-06-15T00:00:00.000Z' }]

describe('window predicates', () => {
  it('inQuietHours wraps midnight (21→8)', () => {
    expect(inQuietHours(NIGHT, CHI, DEFAULT_SETTINGS)).toBe(true)
    expect(inQuietHours(NOON, CHI, DEFAULT_SETTINGS)).toBe(false)
  })
  it('inDigestWindow = digest day, at-or-after digest hour', () => {
    expect(inDigestWindow(SUNDAY, CHI, DEFAULT_SETTINGS)).toBe(true)
    expect(inDigestWindow(NOON, CHI, DEFAULT_SETTINGS)).toBe(false)
  })
})

describe('runNudgePipeline', () => {
  it('emits a new immediate finding and records it as emitted', async () => {
    const { payload, created } = db({ schedules: FIRING_SCHEDULE })
    const out = await runNudgePipeline(payload, 7, NOON)
    const coverage = out.find((n) => n.rule === 'prayer.coverage_gap')
    expect(coverage).toBeDefined()
    expect(created.find((c) => c.dedupKey === 'coverage:2026-06')).toMatchObject({ status: 'emitted' })
  })

  it('holds immediates during quiet hours without recording state', async () => {
    const { payload, created } = db({ schedules: FIRING_SCHEDULE })
    const out = await runNudgePipeline(payload, 7, NIGHT)
    expect(out.find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()
    expect(created.find((c) => c.dedupKey === 'coverage:2026-06')).toBeUndefined()
  })

  it('re-emits an emitted-but-unacked state instead of creating a duplicate', async () => {
    const { payload, created } = db({
      schedules: FIRING_SCHEDULE,
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'emitted', tier: 'immediate' }],
    })
    const out = await runNudgePipeline(payload, 7, NOON)
    const coverage = out.filter((n) => n.rule === 'prayer.coverage_gap')
    expect(coverage).toHaveLength(1)
    expect(coverage[0].id).toBe(55)
    expect(created).toHaveLength(0)
  })

  it('stays silent for delivered-and-unresolved (fire once per problem)', async () => {
    const { payload } = db({
      schedules: FIRING_SCHEDULE,
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate' }],
    })
    const out = await runNudgePipeline(payload, 7, NOON)
    expect(out.find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()
  })

  it('resolution sweep: marks states resolved when their problem stopped firing', async () => {
    const { payload, updated } = db({
      schedules: [{ id: 42, endDate: '2026-09-15T00:00:00.000Z' }], // gap fixed
      states: [{ id: 55, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate' }],
    })
    await runNudgePipeline(payload, 7, NOON)
    expect(updated.find((u) => u.id === 55)?.data).toMatchObject({ status: 'resolved' })
  })

  it('emits the weekly digest only in the digest window', async () => {
    const quiet = db({})
    expect((await runNudgePipeline(quiet.payload, 7, NOON)).find((n) => n.rule === 'digest.weekly')).toBeUndefined()
    const sunday = db({})
    const out = await runNudgePipeline(sunday.payload, 7, SUNDAY)
    expect(out.find((n) => n.rule === 'digest.weekly')).toBeDefined()
  })

  it('respects disabled rules and the master toggle', async () => {
    const disabled = db({
      schedules: FIRING_SCHEDULE,
      settings: [{ enabled: true, disabledRules: ['prayer.coverage_gap'] }],
    })
    expect((await runNudgePipeline(disabled.payload, 7, NOON)).find((n) => n.rule === 'prayer.coverage_gap')).toBeUndefined()

    const off = db({ schedules: FIRING_SCHEDULE, settings: [{ enabled: false }] })
    expect(await runNudgePipeline(off.payload, 7, NOON)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/pipeline.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/ansari/pipeline.ts`**

```typescript
// src/ansari/pipeline.ts
import type { Payload } from 'payload'

import { RULES } from './registry'
import { isoWeekKey, localParts } from './time'
import type { ActionDescriptor, Finding, NudgeContext, NudgeTier, Rule } from './types'

export type NudgeSettings = {
  enabled: boolean
  disabledRules: string[]
  quietHoursStart: number
  quietHoursEnd: number
  digestDay: number // 0=Sunday … 6=Saturday
  digestHour: number
}

export const DEFAULT_SETTINGS: NudgeSettings = {
  enabled: true,
  disabledRules: [],
  quietHoursStart: 21,
  quietHoursEnd: 8,
  digestDay: 0,
  digestHour: 9,
}

export function inQuietHours(now: Date, timezone: string, s: NudgeSettings): boolean {
  const { hour } = localParts(now, timezone)
  const { quietHoursStart: start, quietHoursEnd: end } = s
  if (start === end) return false
  return start > end ? hour >= start || hour < end : hour >= start && hour < end
}

export function inDigestWindow(now: Date, timezone: string, s: NudgeSettings): boolean {
  const { weekday, hour } = localParts(now, timezone)
  // >= so a missed poll at the exact hour doesn't skip a whole week;
  // the digest's week-keyed dedup keeps it to once.
  return weekday === s.digestDay && hour >= s.digestHour
}

export async function loadSettings(payload: Payload, tenantId: string | number): Promise<NudgeSettings> {
  const res = await payload.find({
    collection: 'ansari-settings',
    where: { tenant: { equals: tenantId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs[0] as
    | {
        enabled?: boolean | null
        disabledRules?: string[] | null
        quietHoursStart?: number | null
        quietHoursEnd?: number | null
        digestDay?: string | number | null
        digestHour?: number | null
      }
    | undefined
  if (!doc) return DEFAULT_SETTINGS
  return {
    enabled: doc.enabled ?? true,
    disabledRules: doc.disabledRules ?? [],
    quietHoursStart: doc.quietHoursStart ?? DEFAULT_SETTINGS.quietHoursStart,
    quietHoursEnd: doc.quietHoursEnd ?? DEFAULT_SETTINGS.quietHoursEnd,
    digestDay: Number(doc.digestDay ?? DEFAULT_SETTINGS.digestDay),
    digestHour: doc.digestHour ?? DEFAULT_SETTINGS.digestHour,
  }
}

export async function tenantTimezone(payload: Payload, tenantId: string | number): Promise<string> {
  try {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
    })) as { location?: { timezone?: string | null } } | null
    return tenant?.location?.timezone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export type EmittedNudge = {
  id: string | number
  rule: string
  tier: NudgeTier
  intent: Record<string, unknown>
  action: ActionDescriptor
}

type StateDoc = {
  id: string | number
  rule: string
  dedupKey: string
  status: string
  tier: string
}

export async function runNudgePipeline(
  payload: Payload,
  tenantId: string | number,
  now: Date = new Date(),
): Promise<EmittedNudge[]> {
  const timezone = await tenantTimezone(payload, tenantId)
  const settings = await loadSettings(payload, tenantId)
  if (!settings.enabled) return []

  const ctx: NudgeContext = { payload, tenant: { id: tenantId, timezone }, now }
  const active = RULES.filter((r) => !settings.disabledRules.includes(r.id))
  const digestRule = active.find((r) => r.id === 'digest.weekly')
  const nonDigest = active.filter((r) => r.id !== 'digest.weekly')

  const findings: Array<{ rule: Rule; finding: Finding }> = []
  for (const rule of nonDigest) {
    try {
      for (const f of await rule.evaluate(ctx)) findings.push({ rule, finding: f })
    } catch {
      // one broken rule must not silence the rest
    }
  }

  const statesRes = await payload.find({
    collection: 'nudge-states',
    where: { tenant: { equals: tenantId }, status: { in: ['emitted', 'delivered', 'snoozed'] } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const open = statesRes.docs as StateDoc[]

  // Resolution sweep: a tracked problem that stopped firing is resolved.
  const currentKeys = new Set(findings.map((f) => f.finding.dedupKey))
  const thisWeekDigestKey = `digest:${isoWeekKey(now, timezone)}`
  for (const st of open) {
    const isStaleDigest = st.rule === 'digest.weekly' && st.dedupKey !== thisWeekDigestKey
    const isResolvedProblem =
      st.rule !== 'digest.weekly' &&
      !settings.disabledRules.includes(st.rule) &&
      !currentKeys.has(st.dedupKey)
    if (!isStaleDigest && !isResolvedProblem) continue
    await payload.update({
      collection: 'nudge-states',
      id: st.id,
      data: { status: 'resolved', resolvedAt: now.toISOString() },
      overrideAccess: true,
    })
  }

  // Digest evaluates AFTER the sweep so its unresolved list is fresh.
  const digestOpen = inDigestWindow(now, timezone, settings)
  if (digestRule && digestOpen) {
    try {
      for (const f of await digestRule.evaluate(ctx)) findings.push({ rule: digestRule, finding: f })
    } catch {
      // digest failure must not block immediates
    }
  }

  const openByKey = new Map(open.map((st) => [st.dedupKey, st]))
  const quiet = inQuietHours(now, timezone, settings)
  const out: EmittedNudge[] = []

  for (const { rule, finding } of findings) {
    const gateClosed = rule.tier === 'immediate' ? quiet : !digestOpen
    const existing = openByKey.get(finding.dedupKey)

    if (existing) {
      // at-least-once: emitted-but-never-acked keeps returning (when its gate is open)
      if (existing.status === 'emitted' && !gateClosed) {
        out.push({ id: existing.id, rule: rule.id, tier: rule.tier, intent: finding.intent, action: finding.action })
      }
      continue // delivered → fire-once silence; snoozed → resurfaces via digest content
    }

    if (gateClosed) continue // held, NOT recorded — fires on the next in-window poll

    const created = (await payload.create({
      collection: 'nudge-states',
      data: {
        tenant: tenantId,
        rule: rule.id,
        dedupKey: finding.dedupKey,
        tier: rule.tier,
        status: 'emitted',
        intent: finding.intent,
        action: finding.action,
        emittedAt: now.toISOString(),
      },
      overrideAccess: true,
    })) as { id: string | number }
    out.push({ id: created.id, rule: rule.id, tier: rule.tier, intent: finding.intent, action: finding.action })
  }
  return out
}
```

- [ ] **Step 4: Run the pipeline tests AND the whole suite**

Run: `npm test -- tests/ansari/pipeline.test.ts && npm test`
Expected: PASS / all green.

- [ ] **Step 5: Commit**

```bash
git add src/ansari/pipeline.ts tests/ansari/pipeline.test.ts
git commit -m "feat(ansari): nudge pipeline with dedup, gates, acks and resolution sweep"
```

---

### Task 13: Endpoints — `GET /api/ansari/nudges` + `POST …/:id/ack`

**Files:**
- Create: `src/endpoints/ansari/shared.ts`
- Create: `src/endpoints/ansari/nudges.ts`
- Test: `tests/ansari/endpoints-nudges.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/endpoints-nudges.test.ts
import { describe, expect, it, vi } from 'vitest'

import { ansariNudgesEndpoint, ansariNudgeAckEndpoint } from '@/endpoints/ansari/nudges'

function req(over: Record<string, unknown> = {}) {
  return {
    user: { id: 1, role: 'admin', tenant: 7, _strategy: 'api-key', apiScopes: ['ansari:nudges'] },
    payload: {
      findByID: vi.fn(async () => ({ id: 7, location: { timezone: 'America/Chicago' } })),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(async (a: { data: object }) => ({ id: 1, ...a.data })),
      update: vi.fn(async (a: { data: object }) => a.data),
    },
    routeParams: {},
    ...over,
  } as never
}

describe('GET /api/ansari/nudges', () => {
  it('401s without a user', async () => {
    const res = await ansariNudgesEndpoint.handler(req({ user: null }))
    expect(res.status).toBe(401)
  })

  it('403s an API key missing the ansari:nudges scope', async () => {
    const res = await ansariNudgesEndpoint.handler(
      req({ user: { id: 1, role: 'admin', tenant: 7, _strategy: 'api-key', apiScopes: ['prayer-times:read'] } }),
    )
    expect(res.status).toBe(403)
  })

  it('returns the pipeline output for the caller tenant', async () => {
    const res = await ansariNudgesEndpoint.handler(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('nudges')
    expect(Array.isArray(body.nudges)).toBe(true)
  })
})

describe('POST /api/ansari/nudges/:id/ack', () => {
  it('marks an emitted state delivered', async () => {
    const payload = {
      findByID: vi.fn(async () => ({ id: 55, tenant: 7, status: 'emitted' })),
      update: vi.fn(async (a: { data: object }) => a.data),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(),
    }
    const res = await ansariNudgeAckEndpoint.handler(req({ payload, routeParams: { id: '55' } }))
    expect(res.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'nudge-states',
        id: '55',
        data: expect.objectContaining({ status: 'delivered' }),
      }),
    )
  })

  it('is idempotent for unknown ids', async () => {
    const payload = {
      findByID: vi.fn(async () => {
        throw new Error('NotFound')
      }),
      update: vi.fn(),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(),
    }
    const res = await ansariNudgeAckEndpoint.handler(req({ payload, routeParams: { id: '999' } }))
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('unknown')
  })

  it('rejects a state belonging to another tenant', async () => {
    const payload = {
      findByID: vi.fn(async () => ({ id: 55, tenant: 999, status: 'emitted' })),
      update: vi.fn(),
      find: vi.fn(async () => ({ docs: [], totalDocs: 0 })),
      create: vi.fn(),
    }
    const res = await ansariNudgeAckEndpoint.handler(req({ payload, routeParams: { id: '55' } }))
    expect(res.status).toBe(404)
    expect(payload.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/endpoints-nudges.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement shared auth helper + both endpoints**

```typescript
// src/endpoints/ansari/shared.ts
import type { PayloadRequest } from 'payload'

import { isApiKeyAuth } from '@/access/apiScoped'

export function extractId(rel: unknown): string | number | null {
  if (rel == null) return null
  if (typeof rel === 'object' && 'id' in rel) return (rel as { id: string | number }).id
  return rel as string | number
}

/**
 * All /api/ansari/* endpoints: session admins/platformOwners pass; API keys
 * must carry the ansari:nudges scope. Returns the caller's tenant id.
 */
export function authorizeAnsari(req: PayloadRequest): { tenantId: string | number } | Response {
  const user = req.user as
    | { role?: string; tenant?: unknown; apiScopes?: string[] | null }
    | null
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (isApiKeyAuth(req)) {
    if (!(user.apiScopes ?? []).includes('ansari:nudges')) {
      return Response.json({ error: 'Forbidden — missing ansari:nudges scope' }, { status: 403 })
    }
  } else if (user.role !== 'admin' && user.role !== 'platformOwner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const tenantId = extractId(user.tenant)
  if (!tenantId) return Response.json({ error: 'No tenant on this account' }, { status: 400 })
  return { tenantId }
}

export function hasApiScope(req: PayloadRequest, scope: string): boolean {
  if (!isApiKeyAuth(req)) return true // session admins already passed role checks
  const scopes = (req.user as { apiScopes?: string[] | null } | null)?.apiScopes ?? []
  return scopes.includes(scope)
}

export type NudgeStateDoc = {
  id: string | number
  tenant: unknown
  rule: string
  dedupKey: string
  status: string
  tier: string
  intent?: Record<string, unknown>
  action?: Record<string, unknown>
}

/** Load a nudge state, enforcing tenant ownership. null = not found / foreign. */
export async function loadOwnState(
  req: PayloadRequest,
  tenantId: string | number,
  id: unknown,
): Promise<NudgeStateDoc | 'missing' | 'foreign'> {
  try {
    const doc = (await req.payload.findByID({
      collection: 'nudge-states',
      id: id as string,
      depth: 0,
      overrideAccess: true,
    })) as NudgeStateDoc | null
    if (!doc) return 'missing'
    if (String(extractId(doc.tenant)) !== String(tenantId)) return 'foreign'
    return doc
  } catch {
    return 'missing'
  }
}
```

```typescript
// src/endpoints/ansari/nudges.ts
import type { Endpoint } from 'payload'

import { runNudgePipeline } from '@/ansari/pipeline'
import { authorizeAnsari, loadOwnState } from './shared'

export const ansariNudgesEndpoint: Endpoint = {
  path: '/ansari/nudges',
  method: 'get',
  handler: async (req) => {
    const auth = authorizeAnsari(req)
    if (auth instanceof Response) return auth
    const nudges = await runNudgePipeline(req.payload, auth.tenantId)
    return Response.json({ nudges })
  },
}

export const ansariNudgeAckEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/ack',
  method: 'post',
  handler: async (req) => {
    const auth = authorizeAnsari(req)
    if (auth instanceof Response) return auth
    const id = req.routeParams?.id
    const state = await loadOwnState(req, auth.tenantId, id)
    if (state === 'missing') return Response.json({ ok: true, status: 'unknown' })
    if (state === 'foreign') return Response.json({ error: 'Not found' }, { status: 404 })
    if (state.status === 'emitted') {
      await req.payload.update({
        collection: 'nudge-states',
        id: id as string,
        data: { status: 'delivered', deliveredAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }
    return Response.json({ ok: true, status: 'delivered' })
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/ansari/endpoints-nudges.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/ansari/shared.ts src/endpoints/ansari/nudges.ts tests/ansari/endpoints-nudges.test.ts
git commit -m "feat(ansari): GET /api/ansari/nudges and ack endpoint"
```

---

### Task 14: Endpoints — `apply`, `dismiss`, `snooze`, `mute`

**Files:**
- Create: `src/endpoints/ansari/nudgeActions.ts`
- Test: `tests/ansari/endpoints-actions.test.ts`

Apply semantics (spec §stale-apply): missing/terminal state → `already-handled`; rule re-evaluates; dedupKey gone → resolve + `already-handled`; action materially different (JSON-compared) → update state to fresh proposal, return `changed`; same + `direct` → execute, return `applied`; same + `conversation-starter` → mark applied, return `handoff` with the intent. API keys must additionally hold the rule's `requiredScope`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ansari/endpoints-actions.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  ansariNudgeApplyEndpoint,
  ansariNudgeDismissEndpoint,
  ansariNudgeMuteEndpoint,
  ansariNudgeSnoozeEndpoint,
} from '@/endpoints/ansari/nudgeActions'

// The apply handler builds its NudgeContext from the real clock — pin it so
// the coverage-gap fixtures below evaluate deterministically forever.
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-11T17:00:00Z'))
})
afterAll(() => vi.useRealTimers())

const FIRING_SCHEDULE = { docs: [{ id: 42, endDate: '2026-06-15T00:00:00.000Z' }], totalDocs: 1 }
// matches what prayer.coverage_gap produces for the firing schedule on 2026-06-11
const STORED_ACTION = {
  kind: 'direct',
  op: 'extendSchedule',
  params: { scheduleId: 42, newEndDate: '2026-07-31' },
  summary: 'Extend the prayer schedule through 2026-07-31',
}

function req(over: { state?: object | null; schedules?: object; scopes?: string[]; settings?: object[] } = {}) {
  const state =
    over.state === undefined
      ? { id: 55, tenant: 7, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate', action: STORED_ACTION, intent: {} }
      : over.state
  const payload = {
    findByID: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'nudge-states') {
        if (!state) throw new Error('NotFound')
        return state
      }
      if (collection === 'tenants') return { id: 7, location: { timezone: 'America/Chicago' } }
      return null
    }),
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'prayer-schedules') return over.schedules ?? FIRING_SCHEDULE
      if (collection === 'ansari-settings') return { docs: over.settings ?? [], totalDocs: 0 }
      return { docs: [], totalDocs: 0 }
    }),
    update: vi.fn(async (a: { data: object }) => a.data),
    create: vi.fn(async (a: { data: object }) => ({ id: 2, ...a.data })),
  }
  return {
    raw: {
      user: { id: 1, role: 'admin', tenant: 7, _strategy: 'api-key', apiScopes: over.scopes ?? ['ansari:nudges', 'prayer-times:write'] },
      payload,
      routeParams: { id: '55' },
    } as never,
    payload,
  }
}

describe('POST /api/ansari/nudges/:id/apply', () => {
  it('re-validates and executes when the problem still fires with the same action', async () => {
    const { raw, payload } = req()
    const res = await ansariNudgeApplyEndpoint.handler(raw)
    const body = await res.json()
    expect(body.status).toBe('applied')
    // executed the schedule extension…
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'prayer-schedules', id: 42 }),
    )
    // …and marked the state applied
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'nudge-states', data: expect.objectContaining({ status: 'applied' }) }),
    )
  })

  it('answers already-handled when the problem no longer fires (and resolves the state)', async () => {
    const { raw, payload } = req({ schedules: { docs: [{ id: 42, endDate: '2026-09-15T00:00:00.000Z' }], totalDocs: 1 } })
    const body = await (await ansariNudgeApplyEndpoint.handler(raw)).json()
    expect(body.status).toBe('already-handled')
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'nudge-states', data: expect.objectContaining({ status: 'resolved' }) }),
    )
  })

  it('answers already-handled for a missing state (stale Telegram button, never a 404)', async () => {
    const { raw } = req({ state: null })
    const body = await (await ansariNudgeApplyEndpoint.handler(raw)).json()
    expect(body.status).toBe('already-handled')
  })

  it('returns changed (and does NOT execute) when the fresh action differs', async () => {
    // Same dedupKey still fires, but the stored proposal is stale (data moved
    // since the nudge): fresh evaluate proposes 2026-07-31, stored says 2026-06-30.
    const { raw, payload } = req({
      state: {
        id: 55,
        tenant: 7,
        rule: 'prayer.coverage_gap',
        dedupKey: 'coverage:2026-06',
        status: 'delivered',
        tier: 'immediate',
        intent: {},
        action: {
          ...STORED_ACTION,
          params: { scheduleId: 42, newEndDate: '2026-06-30' },
          summary: 'Extend the prayer schedule through 2026-06-30',
        },
      },
    })
    const body = await (await ansariNudgeApplyEndpoint.handler(raw)).json()
    expect(body.status).toBe('changed')
    expect(body.nudge.action.params.newEndDate).toBe('2026-07-31') // fresh proposal included
    expect(payload.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'prayer-schedules' }),
    )
    // state re-armed with the fresh proposal
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'nudge-states',
        data: expect.objectContaining({ status: 'emitted' }),
      }),
    )
  })

  it('403s an API key lacking the rule requiredScope', async () => {
    const { raw } = req({ scopes: ['ansari:nudges'] }) // no prayer-times:write
    expect((await ansariNudgeApplyEndpoint.handler(raw)).status).toBe(403)
  })
})

describe('dismiss / snooze / mute', () => {
  it('dismiss marks the state dismissed', async () => {
    const { raw, payload } = req()
    await ansariNudgeDismissEndpoint.handler(raw)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'nudge-states', data: expect.objectContaining({ status: 'dismissed' }) }),
    )
  })

  it('snooze marks the state snoozed with a timestamp', async () => {
    const { raw, payload } = req()
    await ansariNudgeSnoozeEndpoint.handler(raw)
    const call = payload.update.mock.calls.find((c) => c[0].collection === 'nudge-states')![0]
    expect(call.data.status).toBe('snoozed')
    expect(call.data.snoozedAt).toBeTruthy()
  })

  it('mute adds the rule to disabledRules (creating settings when absent) and dismisses', async () => {
    const { raw, payload } = req({ settings: [] })
    const body = await (await ansariNudgeMuteEndpoint.handler(raw)).json()
    expect(body.ok).toBe(true)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'ansari-settings',
        data: expect.objectContaining({ tenant: 7, disabledRules: ['prayer.coverage_gap'] }),
      }),
    )
  })

  it('mute merges into existing settings without duplicates', async () => {
    const { raw, payload } = req({ settings: [{ id: 3, disabledRules: ['prayer.coverage_gap'] }] })
    await ansariNudgeMuteEndpoint.handler(raw)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'ansari-settings',
        id: 3,
        data: { disabledRules: ['prayer.coverage_gap'] },
      }),
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/ansari/endpoints-actions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/endpoints/ansari/nudgeActions.ts`**

```typescript
// src/endpoints/ansari/nudgeActions.ts
import type { Endpoint, PayloadRequest } from 'payload'

import { tenantTimezone } from '@/ansari/pipeline'
import { ruleById } from '@/ansari/registry'
import type { NudgeContext } from '@/ansari/types'
import { authorizeAnsari, hasApiScope, loadOwnState, type NudgeStateDoc } from './shared'

const TERMINAL = ['applied', 'dismissed', 'resolved']

async function setStatus(
  req: PayloadRequest,
  id: string | number,
  data: Record<string, unknown>,
): Promise<void> {
  await req.payload.update({ collection: 'nudge-states', id, data, overrideAccess: true })
}

type Loaded = { tenantId: string | number; state: NudgeStateDoc }

async function loadForAction(req: PayloadRequest): Promise<Loaded | Response | 'gone'> {
  const auth = authorizeAnsari(req)
  if (auth instanceof Response) return auth
  const state = await loadOwnState(req, auth.tenantId, req.routeParams?.id)
  if (state === 'missing') return 'gone'
  if (state === 'foreign') return Response.json({ error: 'Not found' }, { status: 404 })
  return { tenantId: auth.tenantId, state }
}

export const ansariNudgeApplyEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/apply',
  method: 'post',
  handler: async (req) => {
    const loaded = await loadForAction(req)
    if (loaded instanceof Response) return loaded
    // Stale Telegram buttons must always land somewhere graceful — never a 404.
    if (loaded === 'gone') {
      return Response.json({ status: 'already-handled', message: 'This nudge no longer exists.' })
    }
    const { tenantId, state } = loaded
    if (TERMINAL.includes(state.status)) return Response.json({ status: 'already-handled' })

    const rule = ruleById(state.rule)
    if (!rule) return Response.json({ status: 'error', message: `Unknown rule ${state.rule}` }, { status: 500 })
    if (rule.requiredScope && !hasApiScope(req, rule.requiredScope)) {
      return Response.json({ error: `Forbidden — missing ${rule.requiredScope} scope` }, { status: 403 })
    }

    const ctx: NudgeContext = {
      payload: req.payload,
      tenant: { id: tenantId, timezone: await tenantTimezone(req.payload, tenantId) },
      now: new Date(),
    }

    // Re-validation reuses evaluate() — discovery and apply share one source of truth.
    const fresh = (await rule.evaluate(ctx)).find((f) => f.dedupKey === state.dedupKey)
    if (!fresh) {
      await setStatus(req, state.id, { status: 'resolved', resolvedAt: ctx.now.toISOString() })
      return Response.json({ status: 'already-handled' })
    }

    // The admin only ever gets what they actually confirmed.
    if (JSON.stringify(fresh.action) !== JSON.stringify(state.action)) {
      await setStatus(req, state.id, { action: fresh.action, intent: fresh.intent, status: 'emitted' })
      return Response.json({
        status: 'changed',
        nudge: { id: state.id, rule: state.rule, intent: fresh.intent, action: fresh.action },
      })
    }

    if (fresh.action.kind === 'conversation-starter' || !rule.execute) {
      await setStatus(req, state.id, { status: 'applied' })
      return Response.json({ status: 'handoff', intent: fresh.intent, topic: fresh.action.kind === 'conversation-starter' ? fresh.action.topic : null })
    }

    const result = await rule.execute(ctx, fresh)
    await setStatus(req, state.id, { status: 'applied' })
    return Response.json({ status: 'applied', detail: result.detail })
  },
}

export const ansariNudgeDismissEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/dismiss',
  method: 'post',
  handler: async (req) => {
    const loaded = await loadForAction(req)
    if (loaded instanceof Response) return loaded
    if (loaded === 'gone') return Response.json({ ok: true, status: 'unknown' })
    await setStatus(req, loaded.state.id, { status: 'dismissed' })
    return Response.json({ ok: true, status: 'dismissed' })
  },
}

export const ansariNudgeSnoozeEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/snooze',
  method: 'post',
  handler: async (req) => {
    const loaded = await loadForAction(req)
    if (loaded instanceof Response) return loaded
    if (loaded === 'gone') return Response.json({ ok: true, status: 'unknown' })
    await setStatus(req, loaded.state.id, { status: 'snoozed', snoozedAt: new Date().toISOString() })
    return Response.json({ ok: true, status: 'snoozed' })
  },
}

export const ansariNudgeMuteEndpoint: Endpoint = {
  path: '/ansari/nudges/:id/mute',
  method: 'post',
  handler: async (req) => {
    const loaded = await loadForAction(req)
    if (loaded instanceof Response) return loaded
    if (loaded === 'gone') return Response.json({ ok: true, status: 'unknown' })
    const { tenantId, state } = loaded

    const res = await req.payload.find({
      collection: 'ansari-settings',
      where: { tenant: { equals: tenantId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const settings = res.docs[0] as { id: string | number; disabledRules?: string[] | null } | undefined
    if (settings) {
      const merged = Array.from(new Set([...(settings.disabledRules ?? []), state.rule]))
      await req.payload.update({
        collection: 'ansari-settings',
        id: settings.id,
        data: { disabledRules: merged },
        overrideAccess: true,
      })
    } else {
      await req.payload.create({
        collection: 'ansari-settings',
        data: { tenant: tenantId, disabledRules: [state.rule] },
        overrideAccess: true,
      })
    }
    await setStatus(req, state.id, { status: 'dismissed' })
    return Response.json({ ok: true, status: 'muted', rule: state.rule })
  },
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/ansari/endpoints-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/ansari/nudgeActions.ts tests/ansari/endpoints-actions.test.ts
git commit -m "feat(ansari): apply/dismiss/snooze/mute nudge endpoints with stale-apply protection"
```

---

### Task 15: Wire-up, generated types, migration, full gates

**Files:**
- Modify: `src/payload.config.ts` (endpoints array, ~line 155)
- Generated: `src/payload-types.ts`, `src/migrations/<timestamp>_proactive_nudge_engine.ts`

- [ ] **Step 1: Register the five endpoints in `src/payload.config.ts`**

Add imports:

```typescript
import { ansariNudgeAckEndpoint, ansariNudgesEndpoint } from './endpoints/ansari/nudges'
import {
  ansariNudgeApplyEndpoint,
  ansariNudgeDismissEndpoint,
  ansariNudgeMuteEndpoint,
  ansariNudgeSnoozeEndpoint,
} from './endpoints/ansari/nudgeActions'
```

and append to the `endpoints: [...]` array:

```typescript
    ansariNudgesEndpoint,
    ansariNudgeAckEndpoint,
    ansariNudgeApplyEndpoint,
    ansariNudgeDismissEndpoint,
    ansariNudgeSnoozeEndpoint,
    ansariNudgeMuteEndpoint,
```

- [ ] **Step 2: Regenerate Payload types**

Run: `npm run generate:types`
Expected: `src/payload-types.ts` gains `AnsariSetting`, `NudgeState`, the Events `signupForm` field, the `gapAtCreation` fields, and the `ansari:nudges` scope enum value. Run `npx tsc --noEmit` after — fix any fallout (there should be none; new code uses local types).

- [ ] **Step 3: Create the migration** (needs the local Postgres from `.env` running)

Run: `npm run payload migrate:create proactive_nudge_engine`
Expected: a new file in `src/migrations/` containing CREATE TABLE for `ansari_settings` + `nudge_states`, ALTER for `events.signup_form_id`, the `gap_at_creation` columns, and the `enum_users_api_scopes` extension (same enum-rebuild pattern as `20260601_200031_api_scopes_capability_surface.ts`). Review the SQL before committing. If the dev DB was auto-pushed (`PAYLOAD_DB_PUSH=true`) and `migrate:create` reports no diff, temporarily point `DATABASE_URI` at a fresh database or generate against the prod-shaped schema — do not skip the migration; production runs `payload migrate` on boot.

- [ ] **Step 4: Full verification gates**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: all clean. These are exactly the CI gates (`.github/workflows/ci.yml`); do not use `[fast-ship]` for this branch.

- [ ] **Step 5: Smoke-test against the dev server** (optional but recommended; see memory: dev server on 3001, tenant endpoints need `demo.localhost` host)

```bash
# with a logged-in admin session or an API key carrying ansari:nudges:
curl -s -H "Authorization: users API-Key $ANSARI_KEY" http://demo.localhost:3001/api/ansari/nudges | jq .
```
Expected: `{"nudges": [...]}` — content depends on demo-tenant data (a schedule ending soon will produce a `prayer.coverage_gap` nudge).

- [ ] **Step 6: Update the spec status and commit**

In `docs/superpowers/specs/2026-05-31-proactive-nudge-engine-design.md`, change the Status line to `Implemented (OpenMasjid side) — Hermes integration pending` and add `- **Plan:** [2026-06-11 plan](../plans/2026-06-11-proactive-nudge-engine.md)`.

```bash
git add src/payload.config.ts src/payload-types.ts src/migrations docs/superpowers/specs/2026-05-31-proactive-nudge-engine-design.md
git commit -m "feat(ansari): wire nudge endpoints, types and migration for proactive nudge engine"
```

---

## Out of scope for this plan (tracked, not forgotten)

- **Hermes side** (separate repo/VM): hourly cron → `GET /api/ansari/nudges` → phrase via SOUL.md → Telegram buttons → `POST ack/apply/dismiss/snooze/mute`; digest figures rendered via deterministic template. Do after this lands.
- **`donations.milestone`** — cut; blocked on capability-surface v1.1 (`donations:read`, sum endpoint, goal field).
- **NudgeState 90-day GC** of resolved records — trivial follow-up (a where-clause delete in a maintenance script); not needed until volume exists.
- **Multi-tenant fan-out** — the endpoints are already per-tenant via the caller's key; productization is the separate multi-tenant spec.
