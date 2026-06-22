# Enrollment Hub + Grade Mapping — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote student placement into a first-class, re-enterable **Enrollment** admin tab (needs-placement queue + per-class rosters with place/move/withdraw + inline add), remove the placement step from the Setup wizard, and map a registration `grade` field onto `students.gradeLevel`.

**Architecture:** Reuse existing patterns — a server page under `src/app/(payload)/admin/programs/enrollment/` (mirrors `whos-here/page.tsx`) wrapping a client component in Payload's `DefaultTemplate`; the client uses the `api()` REST wrapper with the logged-in admin session. Placement logic is lifted from `StepStudents.tsx`. This is Phase 1 of the larger program-registration/tuition effort (spec: `docs/superpowers/specs/2026-06-19-program-tuition-multichild-registration-design.md`); it is independent of billing and shippable on its own.

**Tech Stack:** Next.js App Router, Payload CMS 3 (REST), React client components, vitest (unit tests for pure logic), TypeScript. UI uses existing `ss-*` CSS classes.

**Branch:** `feat/registration-details-on-student` (PR #140 umbrella).

**Verification note:** vitest under `src/` only collects `*.test.ts` in a `node` env (no DOM) — so React components are verified via `npx tsc --noEmit` + `npm run lint` + manual dev-server smoke test; pure logic (`mapRegistrationFields`, `firstIncompleteStep`) is unit-tested.

---

## File structure

- **Create** `src/hooks/createStudentFromRegistration.test.ts` — unit test for grade mapping.
- **Modify** `src/hooks/createStudentFromRegistration.ts` — map `student_grade`/`grade` → `gradeLevel`.
- **Modify** `src/collections/Students.ts` — update `gradeLevel` field description.
- **Create** `src/lib/school-setup.test.ts` — unit test for `firstIncompleteStep`.
- **Modify** `src/lib/school-setup.ts` — `firstIncompleteStep` no longer returns 4.
- **Create** `src/app/(payload)/admin/programs/enrollment/page.tsx` — server page.
- **Create** `src/admin/school/Enrollment.tsx` — the hub client (queue + rosters).
- **Modify** `src/admin/school/SchoolTabs.tsx` — add the Enrollment tab.
- **Modify** `src/admin/school/dashboard/DashboardClient.tsx` — repoint banner.
- **Modify** `src/admin/school/HubClient.tsx` — repoint banner.
- **Modify** `src/admin/school/SetupWizard.tsx` — remove the Students/placement step.

---

## Task 1: Map registration `grade` → `students.gradeLevel`

**Files:**
- Test: `src/hooks/createStudentFromRegistration.test.ts`
- Modify: `src/hooks/createStudentFromRegistration.ts` (`mapRegistrationFields`, after the `age` block)
- Modify: `src/collections/Students.ts:47` (description)

- [ ] **Step 1: Write the failing test**

Create `src/hooks/createStudentFromRegistration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mapRegistrationFields } from './createStudentFromRegistration'

describe('mapRegistrationFields — grade', () => {
  it('maps student_grade to gradeLevel', () => {
    const r = mapRegistrationFields(
      { student_first_name: 'Aisha', student_last_name: 'Abbasi', student_grade: '3' },
      1,
    )
    expect(r?.gradeLevel).toBe('3')
  })

  it('falls back to a `grade` field', () => {
    const r = mapRegistrationFields(
      { student_first_name: 'Yusuf', student_last_name: 'Khan', grade: 'Grade 1' },
      1,
    )
    expect(r?.gradeLevel).toBe('Grade 1')
  })

  it('omits gradeLevel when no grade field present', () => {
    const r = mapRegistrationFields(
      { student_first_name: 'Sara', student_last_name: 'Ali' },
      1,
    )
    expect(r?.gradeLevel).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/createStudentFromRegistration.test.ts`
Expected: FAIL — first two assertions fail (`gradeLevel` is `undefined`).

- [ ] **Step 3: Add the mapping**

In `src/hooks/createStudentFromRegistration.ts`, in `mapRegistrationFields`, insert immediately after the `age` block (after the `if (ageRaw != null) { ... }` and before the `const allergies = ...` line):

```ts
  // Grade (e.g. Sunday school): parents supply it at registration; admins place by it.
  const grade = str(data, 'student_grade') ?? str(data, 'grade')
  if (grade) result.gradeLevel = grade
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/createStudentFromRegistration.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Update the field description**

In `src/collections/Students.ts:47`, change the `gradeLevel` admin description from `'Assigned by admin during placement.'` to:

```ts
    { name: 'gradeLevel', type: 'text', admin: { description: 'From registration (or set by admin); used for placement.' } },
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` (expect 0 errors) and `npm run lint` (expect clean for these files)

```bash
git add src/hooks/createStudentFromRegistration.ts src/hooks/createStudentFromRegistration.test.ts src/collections/Students.ts
git commit -m "feat(school): map registration grade to student gradeLevel"
```

---

## Task 2: `firstIncompleteStep` no longer resumes into the removed placement step

**Files:**
- Test: `src/lib/school-setup.test.ts`
- Modify: `src/lib/school-setup.ts` (`firstIncompleteStep`, lines ~44-49)

Context: `firstIncompleteStep(s: HubSummary)` currently returns `1 | 2 | 4 | 5` and returns `4` when `unplacedCount > 0`. With placement removed from Setup, it must never return 4; "complete enough" once a term + ≥1 class exist.

- [ ] **Step 1: Write the failing test**

Create `src/lib/school-setup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { firstIncompleteStep, type HubSummary } from './school-setup'

const base: HubSummary = { term: { id: 1, name: 'T' } as HubSummary['term'], classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 }

describe('firstIncompleteStep', () => {
  it('returns 1 when no term', () => {
    expect(firstIncompleteStep({ ...base, term: null })).toBe(1)
  })
  it('returns 2 when no classes', () => {
    expect(firstIncompleteStep({ ...base, classCount: 0 })).toBe(2)
  })
  it('never returns 4 (placement is no longer a setup step)', () => {
    expect(firstIncompleteStep({ ...base, classCount: 2, unplacedCount: 9 })).not.toBe(4)
  })
  it('returns 5 (finish) once a term and classes exist', () => {
    expect(firstIncompleteStep({ ...base, classCount: 2, unplacedCount: 9 })).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/school-setup.test.ts`
Expected: FAIL — the last two cases get `4`.

- [ ] **Step 3: Update `firstIncompleteStep`**

In `src/lib/school-setup.ts`, replace the function (lines ~44-49) with:

```ts
export function firstIncompleteStep(s: HubSummary): 1 | 2 | 5 {
  if (!s.term) return 1
  if (s.classCount === 0) return 2
  return 5
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/school-setup.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (0 errors — note Task 7 also touches the wizard that consumes this; if a type error appears there, it's fixed in Task 7).

```bash
git add src/lib/school-setup.ts src/lib/school-setup.test.ts
git commit -m "feat(school): firstIncompleteStep no longer resumes into placement step"
```

---

## Task 3: Enrollment hub server page

**Files:**
- Create: `src/app/(payload)/admin/programs/enrollment/page.tsx`

Mirrors `src/app/(payload)/admin/programs/whos-here/page.tsx`. Gated to placement-editing roles (`platformOwner`, `admin`, `school_admin` — excludes `teacher`, since `enrollments` writes are school-admin-only). `importMap` path is `'../../importMap'` (same depth as whos-here).

- [ ] **Step 1: Create the page**

Create `src/app/(payload)/admin/programs/enrollment/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { createLocalReq, getPayload, isEntityHidden, type SanitizedPermissions, type VisibleEntities } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { getAdminUser } from '@/lib/admin-context'
import { loginUrl } from '@/lib/login-redirect'
import { selectedProgramId } from '@/lib/program-context.server'
import { importMap } from '../../importMap'
import Enrollment from '@/admin/school/Enrollment'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROLES = new Set(['platformOwner', 'admin', 'school_admin'])
const idOf = (v: unknown): string | number | null =>
  v == null ? null : typeof v === 'object' && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

export default async function EnrollmentPage({ searchParams }: { searchParams: Promise<{ program?: string }> }) {
  const sp = await searchParams
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl('/admin/programs/enrollment'))

  const role = (user as { role?: string }).role
  if (!role || !ROLES.has(role)) redirect('/admin/programs')

  const payload = await getPayload({ config, importMap })
  const req = await createLocalReq({ user }, payload)

  const visibleEntities: VisibleEntities = {
    collections: payload.config.collections
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
    globals: payload.config.globals
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
  }

  const tenantId = idOf((user as { tenant?: unknown }).tenant)
  const programsRes = await payload.find({
    collection: 'terms',
    where: { ...(tenantId ? { tenant: { equals: tenantId } } : {}) },
    sort: '-startDate',
    limit: 1000,
    depth: 0,
    req,
  })
  const selectedId = await selectedProgramId(sp.program, programsRes.docs as any)

  return (
    <DefaultTemplate
      i18n={req.i18n}
      params={{}}
      payload={payload}
      permissions={permissions as SanitizedPermissions}
      req={req}
      searchParams={{}}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Enrollment programId={selectedId != null ? String(selectedId) : null} />
    </DefaultTemplate>
  )
}
```

- [ ] **Step 2: Verify build/typecheck**

Run: `npx tsc --noEmit`
Expected: one error — `Cannot find module '@/admin/school/Enrollment'` (created in Task 4). That's expected; proceed to Task 4 before committing. (Commit happens at the end of Task 4.)

---

## Task 4: Enrollment hub client (queue + rosters + place/move/withdraw + inline add)

**Files:**
- Create: `src/admin/school/Enrollment.tsx`

Reuses the placement logic from `StepStudents.tsx` (classes → active enrollments → unplaced students; place; inline add) and adds per-class rosters with **move** (= withdraw old + create new active) and **withdraw** (PATCH status `withdrawn`).

- [ ] **Step 1: Create the client component**

Create `src/admin/school/Enrollment.tsx`:

```tsx
'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { UserPlus, RefreshCw } from 'lucide-react'
import { api, toId } from './api'
import SchoolTabs from './SchoolTabs'
import './sunday-school.css'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = { id: number | string; [k: string]: any }
const idStr = (v: unknown): string => String(typeof v === 'object' && v !== null && 'id' in v ? (v as any).id : v)

interface RosterEntry { enrollmentId: string | number; studentId: string; name: string }

const Enrollment: React.FC<{ programId: string | null }> = ({ programId }) => {
  const [classes, setClasses] = useState<Doc[]>([])
  const [unplaced, setUnplaced] = useState<Doc[]>([])
  const [rosters, setRosters] = useState<Record<string, RosterEntry[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // inline add
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [age, setAge] = useState('')
  const [guardian, setGuardian] = useState('')
  const [newClass, setNewClass] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!programId) { setClasses([]); setUnplaced([]); setRosters({}); return }
    setLoading(true); setError('')
    try {
      const cl: Doc[] = (await api(`/school-classes?where[term][equals]=${programId}&where[status][equals]=active&limit=1000&depth=0`)).docs
      setClasses(cl)
      const classIds = cl.map((c) => c.id)
      const enr: Doc[] = classIds.length
        ? (await api(`/enrollments?where[class][in]=${classIds.join(',')}&where[status][equals]=active&limit=5000&depth=1`)).docs
        : []
      const placed = new Set<string>()
      const byClass: Record<string, RosterEntry[]> = {}
      for (const c of cl) byClass[idStr(c.id)] = []
      for (const e of enr) {
        const sid = idStr(e.student)
        placed.add(sid)
        const cid = idStr(e.class)
        const stu = e.student
        const name = typeof stu === 'object' ? (stu.fullName || `${stu.firstName ?? ''} ${stu.lastName ?? ''}`.trim()) : `Student ${sid}`
        if (byClass[cid]) byClass[cid].push({ enrollmentId: e.id, studentId: sid, name })
      }
      for (const cid of Object.keys(byClass)) byClass[cid].sort((a, b) => a.name.localeCompare(b.name))
      setRosters(byClass)
      const students: Doc[] = (await api(`/students?where[status][equals]=active&where[registeredProgram][equals]=${programId}&limit=5000&depth=0`)).docs
      setUnplaced(students.filter((s) => !placed.has(idStr(s.id))).sort((a, b) =>
        String(a.fullName ?? a.firstName).localeCompare(String(b.fullName ?? b.firstName))))
    } catch (e) {
      setError((e as Error).message || 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => { reload() }, [reload])

  const place = async (studentId: string | number, classId: string) => {
    if (!classId) return
    setError('')
    try {
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(studentId), class: toId(classId), status: 'active' }) })
      await reload()
    } catch (e) { setError((e as Error).message || 'Couldn’t place that student.') }
  }

  const withdraw = async (enrollmentId: string | number) => {
    if (!confirm('Withdraw this student from the class?')) return
    setError('')
    try {
      await api(`/enrollments/${toId(enrollmentId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn' }) })
      await reload()
    } catch (e) { setError((e as Error).message || 'Withdraw failed.') }
  }

  // Move = withdraw the current enrollment + create a new active one (history preserved).
  const move = async (enrollmentId: string | number, studentId: string, newClassId: string) => {
    if (!newClassId) return
    setError('')
    try {
      await api(`/enrollments/${toId(enrollmentId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn' }) })
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(studentId), class: toId(newClassId), status: 'active' }) })
      await reload()
    } catch (e) { setError((e as Error).message || 'Move failed.') }
  }

  const addNew = async () => {
    if (!newClass || !first || !last) return
    setBusy(true); setError('')
    try {
      const data: any = { firstName: first, lastName: last, status: 'active', ...(programId ? { registeredProgram: toId(programId) } : {}) }
      if (age) data.age = Number(age)
      if (guardian) data.guardians = [{ name: guardian, isPrimary: true }]
      const student = await api('/students', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(student.id), class: toId(newClass), status: 'active' }) })
      setFirst(''); setLast(''); setAge(''); setGuardian('')
      await reload()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="ss-root">
      <SchoolTabs />
      <header className="ss-masthead">
        <p className="ss-eyebrow">Enrollment</p>
        <h1 className="ss-masthead__title">Place &amp; manage students</h1>
      </header>

      <div className="ss-actions" style={{ margin: '14px 0 0' }}>
        <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => reload()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p className="ss-error">{error}</p>}
      {!programId && <p className="ss-emptyline">Pick a program to manage enrollment.</p>}

      {programId && (
        <>
          {/* Needs placement */}
          <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
            <p className="ss-eyebrow">Needs placement</p>
            {unplaced.length === 0 ? (
              <p className="ss-emptyline">{loading ? 'Loading…' : 'Everyone registered is placed. 🎉'}</p>
            ) : (
              unplaced.map((s) => (
                <div key={s.id} className="ss-row">
                  <span className="ss-row__name">
                    {s.fullName ?? `${s.firstName} ${s.lastName}`}
                    {s.gradeLevel ? <span style={{ color: 'var(--theme-elevation-500)' }}> · grade {s.gradeLevel}</span> : null}
                    {s.age ? <span style={{ color: 'var(--theme-elevation-500)' }}> · age {s.age}</span> : null}
                  </span>
                  <select className="ss-select" style={{ maxWidth: 180 }} defaultValue="" onChange={(e) => place(s.id, e.target.value)}>
                    <option value="">Place in…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ))
            )}
          </div>

          {/* Inline add */}
          <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
            <p className="ss-eyebrow">Add &amp; enroll a new student</p>
            <div className="ss-grid">
              <input className="ss-input" placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
              <input className="ss-input" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
              <input className="ss-input" placeholder="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
              <input className="ss-input" placeholder="Guardian name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
              <select className="ss-select" value={newClass} onChange={(e) => setNewClass(e.target.value)}>
                <option value="">Enroll in class…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="ss-btn ss-btn--ghost" disabled={busy || !first || !last || !newClass} onClick={addNew}>
                <UserPlus size={16} /> Add &amp; enroll
              </button>
            </div>
          </div>

          {/* Class rosters */}
          <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
            <p className="ss-eyebrow">Class rosters</p>
            {classes.length === 0 && <p className="ss-emptyline">No active classes in this program.</p>}
            {classes.map((c) => {
              const cid = idStr(c.id)
              const roster = rosters[cid] ?? []
              return (
                <div key={c.id} style={{ marginBottom: 18 }}>
                  <p className="ss-eyebrow" style={{ color: 'var(--theme-elevation-500)' }}>{c.name} · {roster.length}</p>
                  {roster.length === 0 ? (
                    <p className="ss-emptyline">No students enrolled.</p>
                  ) : (
                    roster.map((r) => (
                      <div key={r.enrollmentId} className="ss-row">
                        <span className="ss-row__name">{r.name}</span>
                        <span style={{ display: 'inline-flex', gap: 8 }}>
                          <select className="ss-select" style={{ maxWidth: 150 }} defaultValue="" onChange={(e) => move(r.enrollmentId, r.studentId, e.target.value)}>
                            <option value="">Move to…</option>
                            {classes.filter((x) => idStr(x.id) !== cid).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </select>
                          <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => withdraw(r.enrollmentId)}>Withdraw</button>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default Enrollment
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` (expect 0 errors — the Task 3 import now resolves) and `npx eslint "src/app/(payload)/admin/programs/enrollment/page.tsx" src/admin/school/Enrollment.tsx` (expect no errors; a pre-existing `set-state-in-effect` warning on `useEffect(() => { reload() })` is acceptable, matching `WhosHere.tsx`).

- [ ] **Step 3: Commit (page + client together)**

```bash
git add "src/app/(payload)/admin/programs/enrollment/page.tsx" src/admin/school/Enrollment.tsx
git commit -m "feat(school): Enrollment hub — placement queue + class rosters (place/move/withdraw)"
```

---

## Task 5: Add the Enrollment tab to the school sub-nav

**Files:**
- Modify: `src/admin/school/SchoolTabs.tsx` (`TABS` array, lines ~11-18; imports line 5)

(We intentionally add it to `SchoolTabs`, not the top-bar `nav-config.ts`, to avoid changing `nav-config.test.ts`.)

- [ ] **Step 1: Add the tab**

In `src/admin/school/SchoolTabs.tsx`, add `Layers` (or reuse an existing icon) to the lucide-react import, then insert the Enrollment tab between Students and Attendance:

```ts
import { LayoutDashboard, GraduationCap, Users, ClipboardList, Wand2, UserCheck, Layers } from 'lucide-react'
```

```ts
  { href: '/admin/programs/students', label: 'Students', icon: Users },
  { href: '/admin/programs/enrollment', label: 'Enrollment', icon: Layers },
  { href: '/admin/programs/attendance', label: 'Attendance', icon: ClipboardList },
```

- [ ] **Step 2: Typecheck + lint + commit**

Run: `npx tsc --noEmit` (0 errors), `npx eslint src/admin/school/SchoolTabs.tsx` (clean)

```bash
git add src/admin/school/SchoolTabs.tsx
git commit -m "feat(school): add Enrollment tab to programs nav"
```

---

## Task 6: Repoint the "students to place" banners to the Enrollment hub

**Files:**
- Modify: `src/admin/school/dashboard/DashboardClient.tsx:91`
- Modify: `src/admin/school/HubClient.tsx:84`

- [ ] **Step 1: Repoint the dashboard banner**

In `src/admin/school/dashboard/DashboardClient.tsx:91`, change the href from `/admin/programs/setup?step=4` to `/admin/programs/enrollment${progQ}`:

```tsx
            {data.attention.unplacedStudents > 0 && <Link href={`/admin/programs/enrollment${progQ}`}>{data.attention.unplacedStudents} student(s) to place</Link>}
```

- [ ] **Step 2: Repoint the hub banner**

In `src/admin/school/HubClient.tsx:84`, change the href from `/admin/programs/setup?step=4` to `/admin/programs/enrollment`:

```tsx
            <Link className="ss-stat__link" href="/admin/programs/enrollment">Place them →</Link>
```

- [ ] **Step 3: Verify no stale step=4 links remain**

Run: `grep -rn "setup?step=4" src` — Expected: no results.

- [ ] **Step 4: Typecheck + lint + commit**

Run: `npx tsc --noEmit` (0 errors), `npm run lint` (clean for these files)

```bash
git add src/admin/school/dashboard/DashboardClient.tsx src/admin/school/HubClient.tsx
git commit -m "feat(school): point 'students to place' to the Enrollment hub"
```

---

## Task 7: Remove the placement step from the Setup wizard

**Files:**
- Modify: `src/admin/school/SetupWizard.tsx`

Setup becomes program config only (Term, Classes, Teachers). The finish screen stays at `step === 5`; Teachers' "next" goes to the finish screen.

- [ ] **Step 1: Remove the Students step from `STEPS` + its import**

In `src/admin/school/SetupWizard.tsx`: remove `Users` from the lucide-react import if it's now unused, remove the `import StepStudents from './steps/StepStudents'` line, and change the `STEPS` array (lines ~15-20) to:

```ts
const STEPS = [
  { key: 'Term', icon: CalendarRange },
  { key: 'Classes', icon: GraduationCap },
  { key: 'Teachers', icon: UserCheck },
] as const
```

- [ ] **Step 2: Update `doneFlags` to 3 elements**

In `doneFlags(s)` (lines ~37-44), remove the 4th array element (the Students-done boolean `s.classCount > 0 && s.unplacedCount === 0 && s.placedCount > 0`) so it returns a 3-element array aligned with the 3 steps.

- [ ] **Step 3: Remove the `step === 4` render block + repoint Teachers**

Remove the `{step === 4 && <StepStudents ... />}` line (~line 110). In the `StepTeachers` render (the `step === 3` block), change its `onNext` to go to the finish screen:

```tsx
{step === 3 && <StepTeachers programId={progId} onBack={() => goto(2)} onNext={() => goto(5)} onChanged={refresh} />}
```

(Keep the `step === 5` finish card as-is.)

- [ ] **Step 4: Fix the resume clamp**

In the resume logic (lines ~65-67), change the clamp upper bound from `4` to `3` so a resume never lands on the removed step (the `cur === 5` finish-screen guard stays):

```ts
    const resume = sp.step ? Number(sp.step) : firstIncompleteStep(s)
    setStep(cur === 5 ? 5 : Math.min(Math.max(resume, 1), 3))
```

(Match the surrounding variable names exactly as they appear in the file.)

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` (0 errors — `firstIncompleteStep` now returns `1 | 2 | 5`, consistent with the clamp), `npx eslint src/admin/school/SetupWizard.tsx` (clean; remove any now-unused imports it flags).

- [ ] **Step 6: Commit**

```bash
git add src/admin/school/SetupWizard.tsx
git commit -m "refactor(school): remove placement step from Setup (now in Enrollment hub)"
```

---

## Task 8: Full verification + manual smoke test

- [ ] **Step 1: Unit tests + build + lint**

Run: `npm run test` (all pass), `npm run lint` (clean), `npx tsc --noEmit` (0 errors).

- [ ] **Step 2: Manual smoke test (dev server, port 3000, tenant host)**

Run `npm run dev`, then verify (run `npx payload migrate` first if any student page is blank):
- `/admin/programs/enrollment` loads; the **Enrollment** tab is in the nav and active.
- "Needs placement" lists active students registered to the program with no active enrollment (shows grade/age); placing one via the dropdown moves them into the class roster and off the queue.
- "Add & enroll" creates a student and enrolls them.
- In a class roster, **Move to…** moves a student to another class (old enrollment withdrawn, appears under the new class); **Withdraw** removes them (off the roster).
- Dashboard "N student(s) to place" banner now links to `/admin/programs/enrollment`.
- `/admin/programs/setup` shows only Term → Classes → Teachers → Finish (no Students step), and "Finish" works from Teachers.

- [ ] **Step 3: Push**

```bash
git push origin HEAD
```

---

## Out of scope (later phases / plans)

Form-builder primitives (sections, repeatable sections, priced options), payment models (free/one-time/recurring), the multi-child family subscription + sibling discount, and the single-class auto-enroll-on-registration wiring are **Phase 2/3** — separate plans. This plan only delivers the standalone Enrollment hub + the grade→`gradeLevel` mapping.
