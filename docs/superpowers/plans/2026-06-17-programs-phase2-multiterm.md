# Programs Phase 2 — Multiple Concurrent Programs + Picker + Rename

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow multiple concurrent programs (each with its own classes/rosters/attendance), selectable via a URL-based picker, with a "New program" flow; and relabel the module/UI from "Sunday School"/"Term" to "Programs"/"Program".

**Architecture:** A pure `resolveProgramId(requested, programs)` picks the program from `?program=<id>` (default newest active). A `ProgramPicker` lives inside `SchoolTabs` (rendered on every page) so it appears everywhere with no per-page wiring. Server pages resolve the selected program and scope their queries to it; the wizard supports a `?program=new` create mode. No schema change.

**Tech Stack:** Payload CMS 3.84, Next.js App Router (searchParams + useSearchParams/useRouter), React, TypeScript, Vitest.

---

## Context the implementer needs

- **Many client components self-fetch the active term** via `api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0')`. Phase 2 changes this to a **selected** program.
- **`ClassesClient` already takes `{ termId, termName }` props** from `classes/page.tsx` — so scoping it is just changing the server page's term resolution. Other clients (`AttendanceClient`, `TakeAttendance`) self-fetch and get a new `programId` prop.
- **`SchoolTabs`** (client, `usePathname`) renders on every management page. Adding the picker there makes it universal.
- The collection slug stays `terms`; only **UI labels** change to "Program(s)".
- No migration (multiple `active` terms are already allowed).

---

## Task 1: `resolveProgramId` helper + tests

**Files:**
- Create: `src/lib/program-context.ts`
- Test: `tests/lib/program-context.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/program-context.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveProgramId } from '@/lib/program-context'

const programs = [
  { id: 1, status: 'active', startDate: '2026-01-04' },
  { id: 2, status: 'active', startDate: '2026-09-06' }, // newest active
  { id: 3, status: 'archived', startDate: '2026-12-01' }, // newest overall but archived
]

describe('resolveProgramId', () => {
  it('returns the requested program when it exists', () => {
    expect(resolveProgramId('1', programs)).toBe(1)
  })
  it('falls back to the newest active when requested is missing/unknown', () => {
    expect(resolveProgramId(null, programs)).toBe(2)
    expect(resolveProgramId('999', programs)).toBe(2)
  })
  it('"new" resolves to null (create mode)', () => {
    expect(resolveProgramId('new', programs)).toBeNull()
  })
  it('falls back to newest of any status when none active', () => {
    expect(resolveProgramId(null, [{ id: 7, status: 'archived', startDate: '2026-03-01' }, { id: 8, status: 'archived', startDate: '2026-06-01' }])).toBe(8)
  })
  it('null when there are no programs', () => {
    expect(resolveProgramId(null, [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/lib/program-context.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/program-context.ts`:

```ts
export interface ProgramRef {
  id: string | number
  status?: string | null
  startDate?: string | null
}

/**
 * Pick the selected program id from a `?program=` value and the tenant's
 * programs. The requested id wins if it exists; `'new'` means create mode
 * (null); otherwise default to the newest active program, then the newest of
 * any status, then null.
 */
export function resolveProgramId(requested: string | null | undefined, programs: ProgramRef[]): string | number | null {
  if (requested === 'new') return null
  if (requested) {
    const found = programs.find((p) => String(p.id) === String(requested))
    if (found) return found.id
  }
  const active = programs.filter((p) => p.status === 'active')
  const pool = active.length ? active : programs
  if (pool.length === 0) return null
  return [...pool].sort((a, b) => String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')))[0].id
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/lib/program-context.test.ts` → PASS. `npm test` → all pass. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/program-context.ts tests/lib/program-context.test.ts
git commit -m "feat(programs): resolveProgramId helper"
```

---

## Task 2: ProgramPicker inside SchoolTabs

**Files:**
- Create: `src/admin/school/ProgramPicker.tsx`
- Modify: `src/admin/school/SchoolTabs.tsx` (render the picker above the tabs)
- Modify: `src/admin/school/sunday-school.css` (picker styles)

- [ ] **Step 1: ProgramPicker**

Create `src/admin/school/ProgramPicker.tsx`:

```tsx
'use client'
import React, { useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Plus, ChevronDown } from 'lucide-react'
import { api } from './api'
import { resolveProgramId } from '@/lib/program-context'

interface Program { id: string | number; name: string; status?: string; startDate?: string | null }

const ProgramPicker: React.FC = () => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [programs, setPrograms] = useState<Program[]>([])

  useEffect(() => {
    api('/terms?limit=1000&depth=0&sort=-startDate').then((r) => setPrograms(r.docs ?? [])).catch(() => {})
  }, [])

  if (programs.length === 0) return null
  const requested = params.get('program')
  const selected = resolveProgramId(requested, programs)

  const go = (value: string) => {
    if (value === 'new') { router.push('/admin/sunday-school/setup?program=new'); return }
    const next = new URLSearchParams(Array.from(params.entries()))
    next.set('program', value)
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="ss-progpick">
      <label className="ss-progpick__label">Program</label>
      <div className="ss-progpick__wrap">
        <select className="ss-progpick__select" value={selected != null ? String(selected) : ''} onChange={(e) => go(e.target.value)}>
          {programs.map((p) => (
            <option key={p.id} value={String(p.id)}>{p.name}{p.status === 'archived' ? ' (archived)' : ''}</option>
          ))}
          <option value="new">+ New program…</option>
        </select>
        <ChevronDown size={15} className="ss-progpick__chev" />
      </div>
    </div>
  )
}

export default ProgramPicker
```

- [ ] **Step 2: Render it in SchoolTabs**

In `src/admin/school/SchoolTabs.tsx`, import the picker and render it just above the `<nav className="ss-tabs">`. Wrap both in a fragment:

```tsx
import ProgramPicker from './ProgramPicker'
// ...
  return (
    <>
      <ProgramPicker />
      <nav className="ss-tabs" aria-label="Sunday school sections">
        {/* ...existing tab map... */}
      </nav>
    </>
  )
```

- [ ] **Step 3: Picker styles**

Append to `src/admin/school/sunday-school.css`:

```css
/* program picker */
.ss-progpick { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.ss-progpick__label { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--theme-elevation-500); }
.ss-progpick__wrap { position: relative; }
.ss-progpick__select {
  appearance: none; -webkit-appearance: none;
  font-family: var(--ss-serif); font-size: 18px; font-weight: 600; color: var(--theme-elevation-900);
  background: transparent; border: 0; border-bottom: 2px solid var(--theme-elevation-200);
  padding: 2px 26px 4px 2px; cursor: pointer;
}
.ss-progpick__select:focus { outline: none; border-bottom-color: var(--ss-teal-500); }
.ss-progpick__chev { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); color: var(--theme-elevation-500); pointer-events: none; }
```

- [ ] **Step 4: Typecheck + commit**

Run `npx tsc --noEmit` (clean) and `npm test` (all pass).
```bash
git add src/admin/school/ProgramPicker.tsx src/admin/school/SchoolTabs.tsx src/admin/school/sunday-school.css
git commit -m "feat(programs): program picker in the management header"
```

---

## Task 3: Scope the Dashboard to the selected program

**Files:**
- Modify: `src/app/(payload)/admin/sunday-school/page.tsx`

- [ ] **Step 1: Resolve the selected program**

Read the file. Add to the imports:
```ts
import { resolveProgramId } from '@/lib/program-context'
```
Change the page signature to receive searchParams: `export default async function SundaySchoolHubPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {` and near the top `const sp = await searchParams`.

Replace the single-active-term lookup (the `payload.find({ collection: 'terms', where: { status active }, sort: -startDate, limit: 1 })` block that sets `const term = termRes.docs[0] ?? null`) with a load-all-then-resolve:

```ts
  const programsRes = await payload.find({
    collection: 'terms',
    where: { ...(tenantId ? { tenant: { equals: tenantId } } : {}) },
    sort: '-startDate',
    limit: 1000,
    depth: 0,
    req,
  })
  const selectedId = resolveProgramId(sp.program, programsRes.docs as any)
  const term = selectedId != null ? (programsRes.docs.find((p: any) => String(p.id) === String(selectedId)) ?? null) : null
```

Everything downstream (`if (term) { ... }`, the teacher branch, DashboardClient) is unchanged — it already keys off `term`.

- [ ] **Step 2: Typecheck + build + commit**

Run `npx tsc --noEmit` (clean), `npm test`, and `npm run build` (exit 0). Then:
```bash
git add "src/app/(payload)/admin/sunday-school/page.tsx"
git commit -m "feat(programs): dashboard scopes to the selected program"
```

---

## Task 4: Scope the Classes list to the selected program

**Files:**
- Modify: `src/app/(payload)/admin/sunday-school/classes/page.tsx`

- [ ] **Step 1: Resolve + pass the selected program**

Read the file. It currently loads the newest active term and passes `termId`/`termName` to `ClassesClient`. Add `import { resolveProgramId } from '@/lib/program-context'`, change the page to accept `{ searchParams }: { searchParams: Promise<{ program?: string }> }` and `const sp = await searchParams`. Replace the single-active-term lookup with:

```ts
  const programsRes = await payload.find({ collection: 'terms', where: { ...(tenantId ? { tenant: { equals: tenantId } } : {}) }, sort: '-startDate', limit: 1000, depth: 0, req })
  const selectedId = resolveProgramId(sp.program, programsRes.docs as any)
  const term = selectedId != null ? (programsRes.docs.find((p: any) => String(p.id) === String(selectedId)) ?? null) : null
```

`ClassesClient` is unchanged (`termId={term ? String(term.id) : null} termName={term?.name ?? null}` stays). `ClassesClient` already filters classes by `where[term][equals]=termId`.

- [ ] **Step 2: Typecheck + commit**

Run `npx tsc --noEmit` (clean), `npm test`. Then:
```bash
git add "src/app/(payload)/admin/sunday-school/classes/page.tsx"
git commit -m "feat(programs): classes list scopes to the selected program"
```

---

## Task 5: Scope Attendance + Take-Attendance to the selected program

**Files:**
- Modify: `src/app/(payload)/admin/sunday-school/attendance/page.tsx`, `src/admin/school/attendance/AttendanceClient.tsx`
- Modify: `src/app/(payload)/admin/take-attendance/page.tsx`, `src/admin/school/TakeAttendance.tsx`

- [ ] **Step 1: Attendance page resolves + passes programId**

In `attendance/page.tsx`: add `import { resolveProgramId } from '@/lib/program-context'`, accept `{ searchParams }: { searchParams: Promise<{ program?: string }> }`, `const sp = await searchParams`, load the tenant's programs (same pattern as Task 4 — needs `tenantId` via `idOf((user as any).tenant)`; add that helper if absent), resolve `selectedId`, and render `<AttendanceClient programId={selectedId != null ? String(selectedId) : null} />`.

- [ ] **Step 2: AttendanceClient filters classes by program**

In `AttendanceClient.tsx`: add a prop `{ programId }: { programId: string | null }`. Change the class-list fetch from `api('/school-classes?where[status][equals]=active&limit=1000&depth=0')` to include the program filter when present:
```ts
    const q = programId ? `&where[term][equals]=${programId}` : ''
    api(`/school-classes?where[status][equals]=active${q}&limit=1000&depth=0`)
```

- [ ] **Step 3: Take-Attendance page resolves + passes programId**

In `take-attendance/page.tsx`: same resolve pattern; render `<TakeAttendance programId={selectedId != null ? String(selectedId) : null} />`. (If the route currently has no tenant/program logic, add the `resolveProgramId` + programs load mirroring Task 4; reuse the gating already present.)

- [ ] **Step 4: TakeAttendance filters classes by program**

In `TakeAttendance.tsx`: add prop `{ programId }: { programId: string | null }`. Change the initial class fetch `api('/school-classes?limit=200&depth=0')` to:
```ts
    const q = programId ? `&where[term][equals]=${programId}` : ''
    api(`/school-classes?limit=200&depth=0${q}`)
```

- [ ] **Step 5: Typecheck + build + commit**

Run `npx tsc --noEmit` (clean), `npm test`, `npm run build` (exit 0). Then:
```bash
git add "src/app/(payload)/admin/sunday-school/attendance/page.tsx" src/admin/school/attendance/AttendanceClient.tsx "src/app/(payload)/admin/take-attendance/page.tsx" src/admin/school/TakeAttendance.tsx
git commit -m "feat(programs): attendance + take-attendance scope to the selected program"
```

---

## Task 6: Wizard — program context + create mode

**Files:**
- Modify: `src/app/(payload)/admin/sunday-school/setup/page.tsx`, `src/admin/school/SetupWizard.tsx`, `src/admin/school/steps/StepTerm.tsx`, `StepClasses.tsx`, `StepTeachers.tsx`, `StepStudents.tsx`

The wizard currently self-resolves "the active term". Make it operate on a resolved program id passed down, with `?program=new` creating a fresh program.

- [ ] **Step 1: setup/page.tsx resolves program + create mode**

In `setup/page.tsx`: accept `{ searchParams }`, `const sp = await searchParams`. Load the tenant's programs, `const selectedId = sp.program === 'new' ? null : resolveProgramId(sp.program, programsRes.docs as any)`. Render `<SetupWizard programId={selectedId != null ? String(selectedId) : null} createMode={sp.program === 'new' || programsRes.docs.length === 0} />`.

- [ ] **Step 2: SetupWizard threads programId to steps**

In `SetupWizard.tsx`: accept props `{ programId, createMode }: { programId: string | null; createMode: boolean }`. Replace its internal "load the active term" calls (`loadSummary` uses `/terms?...active...limit=1`) with a load of the specific program when `programId` is set: fetch `/terms/${programId}?depth=0` for the term, and scope its class/enrollment/student queries by `where[term][equals]=${programId}` (the summary already filters classes by term id — pass `programId`). When `createMode` (no programId), the summary is empty and the wizard starts at Step 1. Pass `programId`/`createMode` into `StepTerm`.

- [ ] **Step 3: StepTerm create vs edit**

In `StepTerm.tsx`: accept `{ programId, createMode }` (in addition to its existing `onNext`/`onChanged`). Replace the on-mount `api('/terms?...active...limit=1')` load: if `createMode` or no `programId`, do NOT prefill (leave `term` null → blank form → save POSTs a new program); else fetch `api('/terms/${programId}?depth=0')` and prefill (save PATCHes that program). The rest (chips, holidays, save) is unchanged.

- [ ] **Step 4: Steps 2–4 scope to the program**

In `StepClasses.tsx`, `StepTeachers.tsx`, `StepStudents.tsx`: each currently fetches the active term to get its id then queries classes by that term. Accept a `programId` prop from `SetupWizard` and use it directly instead of re-fetching the active term (when `programId` is null, they have nothing to show yet — render their empty state). Update `SetupWizard` to pass `programId` to each step.

- [ ] **Step 5: Typecheck + build + commit**

Run `npx tsc --noEmit` (clean), `npm test`, `npm run build` (exit 0). Manually confirm: `?program=new` starts a blank Term step that creates a new program; selecting an existing program edits it.
```bash
git add "src/app/(payload)/admin/sunday-school/setup/page.tsx" src/admin/school/SetupWizard.tsx src/admin/school/steps/
git commit -m "feat(programs): wizard operates on the selected program + create mode"
```

---

## Task 7: Rename "Sunday School" → "Programs" (UI strings)

**Files:**
- Modify: `src/admin/school/SundaySchoolNav.tsx`, `src/admin/school/SchoolTabs.tsx`, `src/admin/school/HubClient.tsx`, `src/admin/school/dashboard/DashboardClient.tsx`, `src/admin/school/dashboard/TeacherDashboard.tsx`, `src/admin/school/SetupWizard.tsx`, `src/admin/school/steps/StepTerm.tsx`, `src/admin/school/TakeAttendance.tsx`, `src/admin/school/classes/ClassesClient.tsx`, `src/admin/school/attendance/AttendanceClient.tsx`, `src/admin/school/students/StudentsClient.tsx`, `src/collections/Terms.ts`

User-facing strings only — do NOT change route paths, slugs, css class names, or `data-*` attributes.

- [ ] **Step 1: Nav + tabs**

In `SundaySchoolNav.tsx`, change the visible link text "Sunday School" → "Programs". In `SchoolTabs.tsx`, change the `aria-label="Sunday school sections"` → "Programs sections" and the Dashboard tab label stays "Dashboard".

- [ ] **Step 2: Eyebrows / titles / empty states**

Across `HubClient.tsx`, `DashboardClient.tsx`, `TeacherDashboard.tsx`, `TakeAttendance.tsx`, `ClassesClient.tsx`, `AttendanceClient.tsx`, `StudentsClient.tsx`: replace user-visible "Sunday school" / "Sunday School" eyebrow/label text with "Programs" (or "Program" where singular reads better), and "No active term yet"/"Set up a term" → "No program yet"/"Set up a program". In `SetupWizard.tsx`, change "Set up your school"/"Set up Sunday School" → "Set up your program". In `StepTerm.tsx`, change the heading "Name your term" → "Name your program" and "Term name" → "Program name" and the button "Create term"/"Save term" → "Create program"/"Save program".

- [ ] **Step 3: Collection labels**

In `src/collections/Terms.ts`: change `labels: { singular: 'Term', plural: 'Terms' }` → `{ singular: 'Program', plural: 'Programs' }`; `admin.group: 'Sunday School'` → `'Programs'`; the `description` "Academic periods for the Sunday school..." → "Programs (e.g. a Sunday school term, a Saturday program, or a summer camp)." Also update the other school collections' `admin.group` if they read `'Sunday School'` (grep `group: 'Sunday School'` across `src/collections/` and change each to `'Programs'`).

- [ ] **Step 4: Typecheck + build + commit**

Run `npx tsc --noEmit` (clean), `npm test`, `npm run build` (exit 0).
```bash
git add -A
git commit -m "feat(programs): rename Sunday School -> Programs in the UI"
```

---

## Task 8: Full verification

- [ ] **Step 1: tsc + suite + build**

Run `npx tsc --noEmit` → 0 errors. `npm test` → all pass. `npm run build` → exit 0; all `/admin/sunday-school*` routes present.

- [ ] **Step 2: Manual verification**

`npm run dev`. Create a second program via the picker's "+ New program" (blank Term step → save). The picker lists both; switching changes the Dashboard, Classes, and Attendance to that program's data. Students stays tenant-wide. The nav/tabs/masthead read "Programs". Take attendance from a program shows that program's classes.

- [ ] **Step 3: Commit (only if anything changed)**

If `generate:importmap` produced changes, commit; otherwise skip.

---

## Self-Review

**Spec coverage (Phase 2):**
- `resolveProgramId` (requested / newest-active fallback / 'new') → Task 1. ✔
- URL-based program picker, default newest active, "+ New program" → Task 2. ✔
- Dashboard / Classes / Attendance / Take-Attendance scoped to the selected program → Tasks 3–5. ✔
- Wizard operates on the selected program + create mode (`?program=new`) → Task 6. ✔
- Students stays tenant-wide (no scoping) → unchanged (noted). ✔
- Rename to "Programs" (nav/tabs/masthead/wizard/empty states/Terms labels) → Task 7. ✔
- No migration → stated. ✔

**Placeholder scan:** none. Tasks 5/6 say "mirror the resolve pattern" — the pattern is fully written in Tasks 3/4 and referenced; the implementer copies it.

**Type consistency:** `resolveProgramId(requested, programs)` (Task 1) consumed identically in the picker (Task 2) and every server page (Tasks 3–6). `programId: string | null` prop name is consistent across `AttendanceClient`/`TakeAttendance`/`SetupWizard`/steps. `ProgramRef` shape (`id`/`status`/`startDate`) matches the `terms` docs the pages load.
