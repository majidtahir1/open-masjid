# Programs Phase 1 — Multi-Day Meeting Days

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a program (internally still a "term") meet on a **set of days** instead of a single weekday, so a daily summer camp (Mon–Fri) or a Sat+Sun program generates sessions on every chosen day.

**Architecture:** Replace the Terms `meetingDay` (single select) with `meetingDays` (hasMany select). A pure `programDates(start, end, days[], holidays)` unions the weekly dates across days; the session generator, the re-sync hook, the bead timeline, and the wizard's Term step all use it. A pure `formatDays(days)` renders a readable label.

**Tech Stack:** Payload CMS 3.84, Postgres (hasMany select → join table), Next.js/React, TypeScript, Vitest.

---

## Context the implementer needs

- **`meetingDay` lives in many places** (all swap to `meetingDays: string[]`): `src/collections/Terms.ts`, `src/hooks/generateClassSessions.ts`, `src/hooks/syncTermSessions.ts`, `src/admin/school/SessionTimeline.tsx`, `src/admin/school/steps/StepTerm.tsx`, `src/admin/school/HubClient.tsx`, `src/admin/school/dashboard/DashboardClient.tsx`, `src/app/(payload)/admin/sunday-school/page.tsx`, `src/lib/school-setup.ts`. These are **type-coupled** — Task 3 changes the lib type and every consumer together so `tsc` stays green.
- **`weeklyDates(start, end, weekday, holidays?)`** in `generateClassSessions.ts` stays as the single-day building block; `programDates` is built on it.
- **Migration**: auto-push is OFF. A hasMany select stores in a join table; the migration must **backfill** existing `meetingDay` into the new table before dropping the old column. The user applies migrations (`npx payload migrate`), interactively — do NOT run apply in any task; only `migrate:create`.
- ISO date strings (`YYYY-MM-DD`) sort chronologically with a plain string sort.

---

## Task 1: Pure `programDates` + `formatDays`

**Files:**
- Modify: `src/hooks/generateClassSessions.ts` (add `programDates`)
- Modify: `src/lib/school-setup.ts` (add `formatDays`)
- Test: `tests/hooks/generateClassSessions.test.ts`, `tests/lib/school-setup.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/hooks/generateClassSessions.test.ts`:

```ts
import { programDates } from '@/hooks/generateClassSessions'

describe('programDates', () => {
  it('unions weekly dates across multiple days, sorted ascending', () => {
    // 2026-09-05 is a Saturday, 2026-09-06 a Sunday.
    const dates = programDates('2026-09-05', '2026-09-14', ['saturday', 'sunday'])
    expect(dates).toEqual(['2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13'])
  })
  it('excludes holidays', () => {
    const dates = programDates('2026-09-05', '2026-09-14', ['saturday', 'sunday'], new Set(['2026-09-06']))
    expect(dates).toEqual(['2026-09-05', '2026-09-12', '2026-09-13'])
  })
  it('empty when no days', () => {
    expect(programDates('2026-09-05', '2026-09-14', [])).toEqual([])
  })
  it('single day matches weeklyDates', () => {
    expect(programDates('2026-09-06', '2026-09-27', ['sunday'])).toEqual(['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'])
  })
})
```

Append to `tests/lib/school-setup.test.ts`:

```ts
import { formatDays } from '@/lib/school-setup'

describe('formatDays', () => {
  it('one day → plural', () => { expect(formatDays(['sunday'])).toBe('Sundays') })
  it('weekend pair', () => { expect(formatDays(['saturday', 'sunday'])).toBe('Saturdays & Sundays') })
  it('the five weekdays → Weekdays', () => {
    expect(formatDays(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])).toBe('Weekdays')
  })
  it('all seven → Every day', () => {
    expect(formatDays(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])).toBe('Every day')
  })
  it('arbitrary set joins in week order', () => {
    expect(formatDays(['friday', 'monday', 'wednesday'])).toBe('Mondays, Wednesdays & Fridays')
  })
  it('empty → dash', () => { expect(formatDays([])).toBe('—') })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/hooks/generateClassSessions.test.ts tests/lib/school-setup.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement `programDates`**

In `src/hooks/generateClassSessions.ts`, add after `weeklyDates`:

```ts
/** Union of weekly dates across every day in `days`, deduped, sorted ascending, minus holidays. */
export function programDates(start: string, end: string, days: string[], holidays?: Iterable<string>): string[] {
  const skip = holidays instanceof Set ? holidays : new Set(holidays ?? [])
  const set = new Set<string>()
  for (const d of days) {
    for (const iso of weeklyDates(start, end, d)) set.add(iso)
  }
  return [...set].filter((iso) => !skip.has(iso)).sort()
}
```

- [ ] **Step 4: Implement `formatDays`**

In `src/lib/school-setup.ts`, add (exported):

```ts
const WEEK_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const PLURAL: Record<string, string> = {
  sunday: 'Sundays', monday: 'Mondays', tuesday: 'Tuesdays', wednesday: 'Wednesdays',
  thursday: 'Thursdays', friday: 'Fridays', saturday: 'Saturdays',
}

/** Human label for a set of meeting days, e.g. "Saturdays & Sundays", "Weekdays", "Every day". */
export function formatDays(days: string[]): string {
  const set = new Set(days)
  if (set.size === 0) return '—'
  if (set.size === 7) return 'Every day'
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  if (set.size === 5 && weekdays.every((d) => set.has(d))) return 'Weekdays'
  const ordered = WEEK_ORDER.filter((d) => set.has(d)).map((d) => PLURAL[d])
  if (ordered.length === 1) return ordered[0]
  return `${ordered.slice(0, -1).join(', ')} & ${ordered[ordered.length - 1]}`
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/hooks/generateClassSessions.test.ts tests/lib/school-setup.test.ts` → PASS. `npm test` → all pass. `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/generateClassSessions.ts src/lib/school-setup.ts tests/hooks/generateClassSessions.test.ts tests/lib/school-setup.test.ts
git commit -m "feat(programs): programDates + formatDays helpers"
```

---

## Task 2: Terms `meetingDays` field + server hooks + migration

**Files:**
- Modify: `src/collections/Terms.ts`
- Modify: `src/hooks/generateClassSessions.ts` (the hook body), `src/hooks/syncTermSessions.ts`
- Migration: generated + hand-edited (file only; user applies)

- [ ] **Step 1: Swap the field**

In `src/collections/Terms.ts`, replace the `meetingDay` field with:

```ts
    {
      name: 'meetingDays',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['sunday'],
      label: 'Meets on',
      options: [
        { label: 'Sunday', value: 'sunday' },
        { label: 'Monday', value: 'monday' },
        { label: 'Tuesday', value: 'tuesday' },
        { label: 'Wednesday', value: 'wednesday' },
        { label: 'Thursday', value: 'thursday' },
        { label: 'Friday', value: 'friday' },
        { label: 'Saturday', value: 'saturday' },
      ],
      admin: { description: 'Days the program meets each week. Sessions are created on every selected day.' },
    },
```

Also change `admin.defaultColumns` from `['name', 'startDate', 'endDate', 'meetingDay', 'status']` to `['name', 'startDate', 'endDate', 'status']` (a hasMany select isn't a useful column).

- [ ] **Step 2: Update the generator hook**

In `src/hooks/generateClassSessions.ts`, in `generateClassSessions`, change the dates line from:

```ts
  const dates = weeklyDates(term.startDate, term.endDate, term.meetingDay ?? 'sunday', holidaySet(term.holidays))
```

to:

```ts
  const days: string[] = Array.isArray(term.meetingDays) ? term.meetingDays : term.meetingDay ? [term.meetingDay] : ['sunday']
  const dates = programDates(term.startDate, term.endDate, days, holidaySet(term.holidays))
```

(The `term.meetingDay` fallback covers any row not yet migrated.)

- [ ] **Step 3: Update the re-sync hook**

In `src/hooks/syncTermSessions.ts`: replace the `meetingDay` reference in the change-detection and the desired-dates computation. Change the `scheduleChanged` line `previousDoc?.meetingDay !== doc.meetingDay ||` to:

```ts
    JSON.stringify(previousDoc?.meetingDays ?? []) !== JSON.stringify(doc.meetingDays ?? []) ||
```

and change the desired line from `const desired = weeklyDates(doc.startDate, doc.endDate, doc.meetingDay ?? 'sunday', holidaySet(doc.holidays))` to:

```ts
  const days: string[] = Array.isArray(doc.meetingDays) ? doc.meetingDays : doc.meetingDay ? [doc.meetingDay] : ['sunday']
  const desired = programDates(doc.startDate, doc.endDate, days, holidaySet(doc.holidays))
```

Add the `programDates` import to syncTermSessions.ts's existing import from `./generateClassSessions` (it already imports `holidaySet, reconcileSessions, weeklyDates`) — add `programDates`.

- [ ] **Step 4: Typecheck + generate types + migration file (with backfill)**

Run `npx tsc --noEmit` (clean) and `npm run generate:types` (expect `Term.meetingDays: (...)[]` replacing `meetingDay`).
Then `npx payload migrate:create term_meeting_days`. Open the generated migration and INSPECT it: it creates a join table (likely `terms_meeting_days` with columns `order`, `parent_id`, `value`) and drops the `meeting_day` column. **Hand-edit the `up` function** so it backfills BEFORE dropping `meeting_day`: after the `CREATE TABLE ... terms_meeting_days ...` statement and before `ALTER TABLE "terms" DROP COLUMN "meeting_day"`, insert (use the real column names from the generated file):

```ts
  await db.execute(sql`
    INSERT INTO "terms_meeting_days" ("order", "parent_id", "value")
    SELECT 1, "id", "meeting_day" FROM "terms" WHERE "meeting_day" IS NOT NULL
  `)
```

(`db` and `sql` are already provided by the migration template's imports/params — match how other migrations in `src/migrations/` call `db.execute(sql\`...\`)`.) Do NOT run `npx payload migrate`.

- [ ] **Step 5: Run suite**

Run `npm test` → all pass (tests don't touch the DB).

- [ ] **Step 6: Commit**

```bash
git add src/collections/Terms.ts src/hooks/generateClassSessions.ts src/hooks/syncTermSessions.ts src/payload-types.ts src/migrations/
git commit -m "feat(programs): meetingDays (multi-day) on terms + session generation"
```

---

## Task 3: Swap the lib + UI to `meetingDays` (atomic)

**Files:**
- Modify: `src/lib/school-setup.ts`, `src/app/(payload)/admin/sunday-school/page.tsx`, `src/admin/school/SessionTimeline.tsx`, `src/admin/school/HubClient.tsx`, `src/admin/school/dashboard/DashboardClient.tsx`, `src/admin/school/steps/StepTerm.tsx`
- Modify: `tests/lib/school-setup.test.ts` (term shape)

All changes in one commit so `tsc` stays green.

- [ ] **Step 1: `school-setup.ts` — HubTerm + buildHubSummary**

In `src/lib/school-setup.ts`: in `HubTerm`, replace `meetingDay?: string | null` with `meetingDays: string[]`. In the `RawDocs.term` type replace `meetingDay?: string | null` with `meetingDays?: string[] | null`. In `buildHubSummary`, replace the `meetingDay: raw.term.meetingDay ?? null,` line with:

```ts
      meetingDays: raw.term.meetingDays ?? [],
```

- [ ] **Step 2: `school-setup.test.ts` — update the term fixture**

In the existing `buildHubSummary` test, the `term` fixture currently has `meetingDay: 'sunday'`. Change it to `meetingDays: ['sunday']`. (The assertions on name/sessionsPerClass are unaffected.)

- [ ] **Step 3: Dashboard route mapping**

In `src/app/(payload)/admin/sunday-school/page.tsx`:
- Change the import `import { weeklyDates, holidaySet } from '@/hooks/generateClassSessions'` to `import { programDates, holidaySet } from '@/hooks/generateClassSessions'`.
- Change the `sessionsPerClass` computation to use `programDates` with the day set:
```ts
    const days: string[] = Array.isArray((term as any).meetingDays) ? (term as any).meetingDays : []
    sessionsPerClass = term.startDate && term.endDate ? programDates(term.startDate, term.endDate, days, holidaySet((term as any).holidays)).length : 0
```
- In the `dashboard.term` object literal, replace `meetingDay: (term as any).meetingDay,` with `meetingDays: ((term as any).meetingDays ?? []),`.

- [ ] **Step 4: `SessionTimeline.tsx`**

Replace the `meetingDay` prop with `meetingDays`. Change the prop type line `meetingDay?: string | null` to `meetingDays?: string[]`, the destructure `meetingDay` to `meetingDays = []`, and the dates line:
```ts
  const all = weeklyDates(startDate, endDate, meetingDay ?? 'sunday')
```
to:
```ts
  const all = programDates(startDate, endDate, meetingDays)
```
Update the import at the top from `weeklyDates` to `programDates` (from `@/hooks/generateClassSessions`).

- [ ] **Step 5: `DashboardClient.tsx`**

Change the `DashboardData.term` type `meetingDay?: string | null` → `meetingDays: string[]`. Change the `<SessionTimeline ... meetingDay={term.meetingDay} ... />` prop to `meetingDays={term.meetingDays}`.

- [ ] **Step 6: `HubClient.tsx`**

Remove the `WEEKDAY_PLURAL` constant and its use. Import `formatDays`: `import { firstIncompleteStep, formatDays } from '@/lib/school-setup'`. Change the masthead meta line `{term.meetingDay ? WEEKDAY_PLURAL[term.meetingDay] ?? 'Weekly' : 'Weekly'}` to `{formatDays(term.meetingDays)}`. Change the `<SessionTimeline ... meetingDay={term.meetingDay} ... />` prop to `meetingDays={term.meetingDays}`.

- [ ] **Step 7: `StepTerm.tsx` — day chips**

Replace the single-day state and `<select>` with a multi-select of day chips:
- Change `const [meetingDay, setDay] = useState('sunday')` to `const [meetingDays, setDays] = useState<string[]>(['sunday'])`.
- On load, replace `setDay(t.meetingDay ?? 'sunday')` with `setDays(Array.isArray(t.meetingDays) && t.meetingDays.length ? t.meetingDays : ['sunday'])`.
- In `save`, replace `meetingDay,` in the data object with `meetingDays,`.
- Replace the `total` line `const total = startDate && endDate ? weeklyDates(startDate, endDate, meetingDay).length : 0` with `const total = startDate && endDate ? programDates(startDate, endDate, meetingDays).length : 0` and import `programDates` (and drop the `weeklyDates` import if now unused) from `@/hooks/generateClassSessions`.
- Replace the "Meets every" `<label><select>...</select></label>` block with a chip multi-select:
```tsx
        <div className="ss-field"><span>Meets on</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {WEEKDAYS.map((d) => {
              const on = meetingDays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  className={`ss-status__btn${on ? ' ss-status__btn--on is-present' : ''}`}
                  style={{ borderRadius: 8, textTransform: 'capitalize' }}
                  aria-pressed={on}
                  onClick={() => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                >
                  {d.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>
```
- Update the `<SessionTimeline ... meetingDay={meetingDay} ... />` call to `meetingDays={meetingDays}`.
- Disable the save button when `meetingDays.length === 0` (extend the existing `disabled` condition: `disabled={busy || !name || !startDate || !endDate || meetingDays.length === 0}`).

- [ ] **Step 8: Typecheck + tests + build**

Run `npx tsc --noEmit` (clean), `npm test` (all pass), `npm run build` (exit 0, no errors).

- [ ] **Step 9: Commit**

```bash
git add src/lib/school-setup.ts src/app/"(payload)"/admin/sunday-school/page.tsx src/admin/school/SessionTimeline.tsx src/admin/school/HubClient.tsx src/admin/school/dashboard/DashboardClient.tsx src/admin/school/steps/StepTerm.tsx tests/lib/school-setup.test.ts
git commit -m "feat(programs): multi-day meeting days across the school UI"
```

---

## Task 4: Full verification

- [ ] **Step 1: Typecheck + suite + build**

Run `npx tsc --noEmit` → 0 errors. `npm test` → all pass. `npm run build` → exit 0.

- [ ] **Step 2: Manual verification (after the user applies the migration)**

`npm run dev`. In the wizard Term step: the **Meets on** chips let you pick multiple days; the session preview shows beads on every chosen day. Create a class → sessions appear for each meeting day. The hub masthead reads e.g. "Saturdays & Sundays". Toggling a day off still works. Existing programs keep their original day (backfilled).

- [ ] **Step 3: Commit (only if anything changed)**

If `generate:importmap` or a regen produced changes, commit; otherwise skip.

---

## Self-Review

**Spec coverage (Phase 1):**
- `meetingDay` → `meetingDays` set on Terms → Task 2. ✔
- Migration adds the join table + **backfills** before dropping the old column → Task 2 Step 4. ✔
- `programDates` union/dedupe/holidays/sorted → Task 1. ✔
- Generator + re-sync use `programDates` (with single-day fallback for unmigrated rows) → Task 2. ✔
- `SessionTimeline` + `StepTerm` (day chips) + masthead `formatDays` → Task 3. ✔
- Tests for `programDates` and `formatDays` → Task 1. ✔

**Placeholder scan:** none. The one inspect-then-write step is Task 2 Step 4 (migration backfill SQL) — unavoidable because the generated join-table column names must be confirmed; a concrete SQL template is given.

**Type consistency:** `programDates(start, end, days[], holidays?)` (Task 1) is consumed with that exact signature in Tasks 2 & 3. `formatDays(days[])` (Task 1) used in Task 3. `HubTerm.meetingDays: string[]` (Task 3 Step 1) matches the `SessionTimeline`/`DashboardClient`/`HubClient` props (Task 3 Steps 4–6) and the `page.tsx` mapping (Step 3). `meetingDays` is the field name everywhere (collection, types, payload docs).
