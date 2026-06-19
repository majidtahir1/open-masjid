# Registration Program Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a registration form declare which program it's for, stamp each registrant with that program, and make placement (wizard + dashboard) strictly per-program.

**Architecture:** Forms gain a `registrationProgram` relationship (required when `schoolRegistration` is on, via the existing guardrail); Students gain a `registeredProgram` relationship set by the registration hook. A pure `unplacedForProgram` helper drives the per-program "to place" count; the wizard's place-registered list and the dashboard count filter to the selected program's registrants. The class Roster stays the tenant-wide catch-all.

**Tech Stack:** Payload CMS 3.84, Postgres (nullable relationship columns → migration), Next.js/React, TypeScript, Vitest.

---

## Context the implementer needs

- **The registration hook** (`src/hooks/createStudentFromRegistration.ts`) loads the form (`findByID`), gates on `form.schoolRegistration === true`, calls `mapRegistrationFields(submissionData, tenantId)`, and creates the student. It must also read `form.registrationProgram` and include it as the student's `registeredProgram`.
- **The Forms guardrail** is a `beforeChange` in `src/collections/Forms.ts` that already throws when `schoolRegistration` is on and required student fields are missing. Extend it to also require `registrationProgram`.
- **Relationship ids from a `<select>`/string** must be coerced with `toId()` before POST (Postgres integer ids). The wizard's manual add will send `registeredProgram`.
- **Migration:** adding two NULLABLE relationship columns is additive (no destructive prompt), so `npx payload migrate:create` runs non-interactively (like the earlier `class_status`/`form_school_registration` migrations). The user applies with `npx payload migrate`.
- `idOf` helper (relationship may be id or populated `{id}`): reuse the small inline pattern already used across the school code.

---

## Task 1: Pure helpers — `unplacedForProgram` + `mapRegistrationFields` program param

**Files:**
- Modify: `src/lib/school-setup.ts` (add `unplacedForProgram`)
- Modify: `src/hooks/createStudentFromRegistration.ts` (`mapRegistrationFields` gains a `registeredProgram` param)
- Test: `tests/lib/school-setup.test.ts`, `tests/hooks/createStudentFromRegistration.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/lib/school-setup.test.ts`:

```ts
import { unplacedForProgram } from '@/lib/school-setup'

describe('unplacedForProgram', () => {
  const students = [
    { id: 1, registeredProgram: 10 },
    { id: 2, registeredProgram: 10 },
    { id: 3, registeredProgram: 20 }, // other program
    { id: 4, registeredProgram: null }, // no program
  ]
  const enrollments = [{ student: 1, status: 'active' }] // student 1 already placed
  it('returns this program’s registrants who are not placed', () => {
    const out = unplacedForProgram(students, enrollments, 10)
    expect(out.map((s) => s.id)).toEqual([2])
  })
  it('ignores other programs and placed students', () => {
    expect(unplacedForProgram(students, [], 20).map((s) => s.id)).toEqual([3])
  })
  it('handles populated relationship objects', () => {
    const s = [{ id: 5, registeredProgram: { id: 10 } }]
    expect(unplacedForProgram(s as any, [], 10).map((x) => x.id)).toEqual([5])
  })
})
```

Update `tests/hooks/createStudentFromRegistration.test.ts` — add a case that the program is included when passed:

```ts
  it('includes registeredProgram when provided', () => {
    const r = mapRegistrationFields({ student_first_name: 'Ali', student_last_name: 'Hassan' }, 9, 55)
    expect(r).toMatchObject({ firstName: 'Ali', lastName: 'Hassan', registeredProgram: 55 })
  })
  it('omits registeredProgram when not provided', () => {
    const r = mapRegistrationFields({ student_first_name: 'Ali', student_last_name: 'Hassan' }, 9)
    expect(r).not.toHaveProperty('registeredProgram')
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/lib/school-setup.test.ts tests/hooks/createStudentFromRegistration.test.ts` → FAIL.

- [ ] **Step 3: Implement `unplacedForProgram`**

In `src/lib/school-setup.ts`, add (the file already has an `idOf` — reuse it; if not, add the one-liner):

```ts
export interface RegisteredStudent { id: string | number; registeredProgram?: unknown }

/** Active students registered for `programId` who are not in the placed set. */
export function unplacedForProgram(
  students: RegisteredStudent[],
  enrollments: Array<{ student: unknown; status?: string }>,
  programId: string | number,
): RegisteredStudent[] {
  const idOfRel = (v: unknown): string =>
    String(typeof v === 'object' && v !== null && 'id' in v ? (v as { id: unknown }).id : v)
  const placed = new Set(enrollments.filter((e) => e.status === 'active').map((e) => idOfRel(e.student)))
  return students.filter((s) => idOfRel(s.registeredProgram) === String(programId) && !placed.has(String(s.id)))
}
```

- [ ] **Step 4: Extend `mapRegistrationFields`**

In `src/hooks/createStudentFromRegistration.ts`, change the signature and add the field (keep all existing mapping):

```ts
export function mapRegistrationFields(
  data: Record<string, unknown>,
  tenantId: string | number,
  registeredProgram?: string | number | null,
): Record<string, unknown> | null {
  // ...existing firstName/lastName/age/allergies/guardians logic, unchanged...
  // after building `result` and before `return result`:
  if (registeredProgram != null) result.registeredProgram = registeredProgram
  return result
}
```

(Place the `if (registeredProgram != null) ...` line just before the final `return result`.)

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/lib/school-setup.test.ts tests/hooks/createStudentFromRegistration.test.ts` → PASS. `npm test` → all pass. `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/school-setup.ts src/hooks/createStudentFromRegistration.ts tests/lib/school-setup.test.ts tests/hooks/createStudentFromRegistration.test.ts
git commit -m "feat(programs): unplacedForProgram helper + registeredProgram mapping"
```

---

## Task 2: Collections — Forms `registrationProgram` + guardrail, Students `registeredProgram` + migration

**Files:**
- Modify: `src/collections/Forms.ts`, `src/collections/Students.ts`

- [ ] **Step 1: Forms `registrationProgram` field**

In `src/collections/Forms.ts`, add — right AFTER the `schoolRegistration` checkbox field — a relationship field shown only when the flag is on:

```ts
    {
      name: 'registrationProgram',
      type: 'relationship',
      relationTo: 'terms',
      admin: {
        position: 'sidebar',
        description: 'Which program registrants are signed up for.',
        condition: (data) => data?.schoolRegistration === true,
      },
    },
```

- [ ] **Step 2: Extend the guardrail**

In `src/collections/Forms.ts`, in the `beforeChange` schema-validation hook, after the existing `hasRequiredRegistrationFields` check, add a program requirement:

```ts
        if (data.schoolRegistration === true && !data.registrationProgram) {
          throw new Error('A registration form must have a program selected (For program).')
        }
```

(Place it right after the existing `if (data.schoolRegistration === true && !hasRequiredRegistrationFields(r.schema)) { ... }` block, inside the same `if (data?.schema)`. Note: this runs only when `schema` is present in the change; that matches the existing field guard.)

- [ ] **Step 3: Students `registeredProgram` field**

In `src/collections/Students.ts`, add (near the `member` relationship field):

```ts
    {
      name: 'registeredProgram',
      type: 'relationship',
      relationTo: 'terms',
      admin: { description: 'The program this student registered for (set at registration). A placement hint — students are not owned by a program.' },
    },
```

- [ ] **Step 4: Typecheck + generate types + migration**

Run `npx tsc --noEmit` (clean), `npm run generate:types` (expect `Form.registrationProgram` and `Student.registeredProgram`).
Then `npx payload migrate:create registration_program_targeting`. INSPECT the generated migration — it should only `ALTER TABLE "forms" ADD COLUMN "registration_program_id"` and `ALTER TABLE "students" ADD COLUMN "registered_program_id"` (+ FKs + indexes), no drops. Confirm a `.json` snapshot was created alongside and it's registered in `src/migrations/index.ts`. Do NOT run `npx payload migrate` (the user applies it). If `migrate:create` prompts (it shouldn't for additive columns), report BLOCKED on generation and ask the user to run it.

- [ ] **Step 5: Run suite**

Run `npm test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/collections/Forms.ts src/collections/Students.ts src/payload-types.ts src/migrations/
git commit -m "feat(programs): registration form program field + student registeredProgram + migration"
```

---

## Task 3: Hook stamps `registeredProgram`

**Files:**
- Modify: `src/hooks/createStudentFromRegistration.ts`

- [ ] **Step 1: Read the program off the form and pass it through**

In `createStudentFromRegistration`, widen the form type and pass the program to the mapper. Change the form cast to include `registrationProgram`:

```ts
  let form: { schoolRegistration?: boolean; registrationProgram?: unknown } | null = null
```

and after the `if (form?.schoolRegistration !== true) return doc` gate, resolve the program id and pass it:

```ts
  const programId =
    form.registrationProgram == null
      ? null
      : typeof form.registrationProgram === 'object'
        ? (form.registrationProgram as { id: string | number }).id
        : (form.registrationProgram as string | number)

  const submissionData = (doc.data ?? {}) as Record<string, unknown>
  const tenantId = typeof doc.tenant === 'object' ? (doc.tenant as { id: string | number }).id : doc.tenant
  const studentData = mapRegistrationFields(submissionData, tenantId, programId)
```

(Replace the existing `const studentData = mapRegistrationFields(submissionData, tenantId)` line.)

- [ ] **Step 2: Typecheck + suite + commit**

Run `npx tsc --noEmit` (clean), `npm test` (all pass).
```bash
git add src/hooks/createStudentFromRegistration.ts
git commit -m "feat(programs): stamp registeredProgram on registrants from the form"
```

---

## Task 4: Per-program placement (dashboard + wizard) + Students pill

**Files:**
- Modify: `src/app/(payload)/admin/sunday-school/page.tsx` (dashboard "to place")
- Modify: `src/admin/school/steps/StepStudents.tsx` (place-registered query + manual-add tag)
- Modify: `src/admin/school/students/StudentsClient.tsx` (registered-for pill)

- [ ] **Step 1: Dashboard "to place" → per-program registrants**

In `src/app/(payload)/admin/sunday-school/page.tsx`, import `unplacedForProgram` from `@/lib/school-setup`. In the `if (term)` block, the `students` query already loads active students — ensure it includes `registeredProgram` (depth 0 returns the id, which is fine). Replace the existing unplaced computation:

```ts
    const placed = new Set(enrollments.filter((e: any) => e.status === 'active').map((e: any) => String(typeof e.student === 'object' ? e.student.id : e.student)))
    const unplaced = students.filter((s: any) => !placed.has(String(s.id))).length
```

with:

```ts
    const unplaced = unplacedForProgram(students as any, enrollments.map((e: any) => ({ student: e.student, status: e.status })), term.id).length
```

(The `teacherless`/`placed`-for-other-uses lines stay if they're used elsewhere; only the `unplaced` count changes. If `placed` becomes unused after this, remove it.)

- [ ] **Step 2: StepStudents — place only this program's registrants + tag manual adds**

In `src/admin/school/steps/StepStudents.tsx`:
- In `reload()`, change the students fetch to only this program's registrants: replace `api('/students?where[status][equals]=active&limit=5000&depth=0')` with
```ts
    const students = programId
      ? (await api(`/students?where[status][equals]=active&where[registeredProgram][equals]=${programId}&limit=5000&depth=0`)).docs
      : []
```
  Keep the existing `placed` filter (students not in this program's active enrollments).
- In `addNew()`, tag the manually-created student with the program: in the `data` object add `registeredProgram: programId ? toId(programId) : undefined` (so manual adds belong to the program too). `toId` is already imported in this file.
- Update the empty-state copy if helpful (e.g. "No one has registered for this program yet.").

- [ ] **Step 3: StudentsClient — "registered for" pill**

In `src/admin/school/students/StudentsClient.tsx`:
- Load programs for name lookup: after the students/enrollments fetch, add `const progs = (await api('/terms?limit=1000&depth=0')).docs` and build `const progName = new Map(progs.map((p: any) => [String(p.id), p.name]))`. (Or fetch students at `depth=1` and read `s.registeredProgram?.name`.)
- For each student row, when `registeredProgram` is set, render a pill: `<span className="ss-pill ss-pill--muted">registered: {progName.get(String(idOf(s.registeredProgram))) ?? '—'}</span>` (reuse the file's `idOf`).

- [ ] **Step 4: Typecheck + build + commit**

Run `npx tsc --noEmit` (clean), `npm test` (all pass), `npm run build` (run directly; exit 0).
```bash
git add "src/app/(payload)/admin/sunday-school/page.tsx" src/admin/school/steps/StepStudents.tsx src/admin/school/students/StudentsClient.tsx
git commit -m "feat(programs): per-program placement + registered-for label"
```

---

## Task 5: Full verification

- [ ] **Step 1: tsc + suite + build**

Run `npx tsc --noEmit` → 0 errors. `npm test` → all pass. `npm run build` → exit 0.

- [ ] **Step 2: Manual verification (after the user applies the migration)**

`npm run dev`. Edit a form, check "Sunday school registration" → a **For program** selector appears; saving without it is rejected. Pick a program, publish, submit the public form → a student is created with that `registeredProgram`. In the wizard for that program, the Students step lists that registrant; the dashboard "to place" counts it. Switching to a different program shows a different (or empty) registrant list. The Students tab shows the "registered: <program>" pill. The class Roster still lets you enroll any unplaced student.

- [ ] **Step 3: Commit (only if anything changed)**

If regen produced changes, commit; else skip.

---

## Self-Review

**Spec coverage:**
- Form `registrationProgram` field (conditional on the flag) → Task 2. ✔
- Guardrail requires a program when the flag is on → Task 2. ✔
- Student `registeredProgram` field + migration → Task 2. ✔
- Hook stamps `registeredProgram` from the form → Tasks 1 (mapper) + 3 (hook). ✔
- Strict per-program placement: wizard Place-registered + dashboard count → Task 4. ✔
- Manual wizard add tags the program → Task 4. ✔
- Class Roster stays the catch-all (unchanged) → not touched (noted). ✔
- Students tab "registered for" pill → Task 4. ✔
- Pure `unplacedForProgram` tested → Task 1. ✔

**Placeholder scan:** none. Task 2 Step 4 is inspect-then-confirm for the generated migration (additive, so non-interactive), with the exact expected DDL stated.

**Type consistency:** `unplacedForProgram(students, enrollments, programId)` (Task 1) consumed in Task 4's dashboard. `mapRegistrationFields(data, tenantId, registeredProgram?)` (Task 1) called with the program id in Task 3. Field name `registeredProgram` (Students) and `registrationProgram` (Forms) are used consistently in the collection (Task 2), hook (Task 3), and queries (Task 4).
