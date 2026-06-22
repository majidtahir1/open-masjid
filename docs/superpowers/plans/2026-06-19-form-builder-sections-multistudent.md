# Form Builder: Sections, Repeatable Participant Sections & Multi-Student Registration — Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Extend the existing form builder so a form can contain **sections** and one **repeatable section** (e.g. "add another child"); submissions store the repeated items as a nested array; registration creates **N students** from one submission (with single-class auto-enroll and a default-class fallback). Payment models are unchanged here (free / one-time) — recurring billing is Phase 3.

**Architecture:** Additive changes to `src/lib/form-schema.ts` (new `section` + `repeatable-group` field types; recursive validation), the builder UI (`src/admin/forms/**`), the public renderer (`PublicFormClient.tsx` + `PublicFormFields.tsx`), and `createStudentFromRegistration.ts` (iterate participants). Nested data lives under a reserved group key; flat top-level answers (guardian/contact) are unchanged, so existing flat forms are unaffected. Compat readers learn to expand the nested key.

**Tech Stack:** Next.js, Payload 3, Zod, React, vitest (pure-logic tests under `tests/`), TypeScript.

**Branch:** `feat/registration-details-on-student` (PR #140).

**Fidelity note:** Schema/validation, the participant→students mapper, and registration-settings invariants get full TDD code (they're pure and the repo tests them this way). The builder UI and public renderer are large React components verified by `tsc` + `lint` + manual; their tasks specify exact files, the new props/contracts, and the key logic snippets.

**Depends on:** Phase 1 (Enrollment hub) merged or in-branch — single-class auto-enroll references the enrollment concept.

---

## File structure

- **Modify** `src/lib/form-schema.ts` — add `section` + `repeatable-group` to `FIELD_TYPES`, the Zod `FieldSchema` union (group nests `fields`), recursive `validateSchema`/`validateSubmission`.
- **Modify** `src/admin/forms/builder/AddFieldPopover.tsx` (`FIELD_DESCRIPTIONS`), `FieldCard.tsx` (`FieldPreview`), `FieldTypeIcon.tsx`, `PropertiesDrawer.tsx`.
- **Modify** `src/admin/forms/FormBuilderField.client.tsx` — `makeDefaultField`, mutators + DnD to support child fields inside a `repeatable-group`.
- **Modify** `src/components/PublicFormFields.tsx` — render `section` + `repeatable-group` (add/remove items).
- **Modify** `src/app/(forms)/forms/[slug]/PublicFormClient.tsx` — collect repeatable items into `values[groupName]` (array), validate nested.
- **Modify** `src/collections/Forms.ts` — `registration` group (`participantModel`), beforeChange invariant.
- **Modify** `src/hooks/createStudentFromRegistration.ts` — iterate participants → N students; single-class auto-enroll; default-class fallback.
- **Create/Modify** `src/lib/school-enroll.ts` — pure helpers: `resolveAutoEnrollClassId`, `participantsFromSubmission`, `mapParticipantToStudent`.
- **Modify** compat readers: `src/lib/form-csv.ts`, `src/lib/form-notifications.ts`, `src/lib/submissions-table.ts`, `src/admin/forms/submissions/SubmissionDrawer.tsx`, `src/lib/form-schema-migrate.ts`.
- **Tests** under `tests/lib/`, `tests/hooks/`.

---

## Task 1: Schema — add `section` and `repeatable-group` field types

**Files:** Modify `src/lib/form-schema.ts`; Test `tests/lib/form-schema.test.ts`.

Model: a `section` is a non-input grouping/heading (like `page-break`, carries `id`, `name`, `label`). A `repeatable-group` carries `id`, `name`, `label`, optional `min`/`max`, `itemLabel` (e.g. "Child"), and a nested `fields: Field[]` (which may NOT themselves contain groups/sections/page-breaks).

- [ ] **Step 1: Write failing tests**

Add to `tests/lib/form-schema.test.ts`:

```ts
import { validateSchema, validateSubmission } from '@/lib/form-schema'

describe('repeatable-group schema', () => {
  const groupSchema = {
    steps: [{ id: 's1', fields: [
      { type: 'short-text', id: 'g1', name: 'guardian_name', label: 'Guardian', required: true },
      { type: 'repeatable-group', id: 'p', name: 'participants', label: 'Children', itemLabel: 'Child', min: 1, max: 10, fields: [
        { type: 'short-text', id: 'f1', name: 'student_first_name', label: 'First', required: true },
        { type: 'short-text', id: 'f2', name: 'student_last_name', label: 'Last', required: true },
      ] },
    ] }],
  }

  it('accepts a valid group schema', () => {
    expect(validateSchema(groupSchema).success).toBe(true)
  })

  it('rejects duplicate names across group + top level', () => {
    const bad = JSON.parse(JSON.stringify(groupSchema))
    bad.steps[0].fields[1].fields[0].name = 'guardian_name'
    expect(validateSchema(bad).success).toBe(false)
  })

  it('validates submission into a nested participants array', () => {
    const r = validateSubmission(groupSchema as any, {
      guardian_name: 'Rahman',
      participants: [
        { student_first_name: 'Aisha', student_last_name: 'Abbasi' },
        { student_first_name: 'Yusuf', student_last_name: 'Abbasi' },
      ],
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.guardian_name).toBe('Rahman')
      expect((r.data.participants as any[]).length).toBe(2)
      expect((r.data.participants as any[])[0].student_first_name).toBe('Aisha')
    }
  })

  it('fails when a required field inside an item is empty', () => {
    const r = validateSubmission(groupSchema as any, {
      guardian_name: 'Rahman',
      participants: [{ student_first_name: '', student_last_name: 'Abbasi' }],
    })
    expect(r.ok).toBe(false)
  })

  it('fails when fewer than min items', () => {
    const r = validateSubmission(groupSchema as any, { guardian_name: 'R', participants: [] })
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run tests/lib/form-schema.test.ts`

- [ ] **Step 3: Implement**

In `src/lib/form-schema.ts`:
1. Add to `FIELD_TYPES`: `{ id: 'section', label: 'Section', hasOptions: false }` and `{ id: 'repeatable-group', label: 'Repeatable group', hasOptions: false }`.
2. Add union members (after `page-break`):

```ts
  z.object({ type: z.literal('section'), id: z.string().min(1), name: z.string().regex(FieldNameRegex), label: z.string().optional() }),
  z.object({
    type: z.literal('repeatable-group'),
    id: z.string().min(1),
    name: z.string().regex(FieldNameRegex),
    label: z.string().optional(),
    itemLabel: z.string().optional(),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(1).optional(),
    // child fields may not nest further structural types
    fields: z.array(z.lazy(() => FieldSchema)).min(1),
  }),
```

3. In `validateSchema`, make name-uniqueness recursive: walk top-level fields and, for any `repeatable-group`, also walk its `fields` (the group name and child names all share one namespace). Reject if a group's child is itself a `section`/`page-break`/`repeatable-group`.

4. In `validateSubmission`, when a field is `repeatable-group`: read `raw[f.name]` as an array; enforce `min`/`max`; validate each item's child fields with the existing per-type logic into a per-item object; write `out[f.name] = items`. `section` is skipped (like `page-break`). Non-group fields keep writing flat `out[f.name]`.

(Implement the helper `validateItem(fields, rawItem)` reusing the existing per-type switch so logic is DRY.)

- [ ] **Step 4: Run — expect PASS.** Also update the existing `FIELD_TYPES.map(t=>t.id)` order assertion in this test file to include the two new ids.

- [ ] **Step 5: Commit**

```bash
git add src/lib/form-schema.ts tests/lib/form-schema.test.ts
git commit -m "feat(forms): add section + repeatable-group field types with recursive validation"
```

---

## Task 2: Registration settings on the form + invariant

**Files:** Modify `src/collections/Forms.ts` (new `registration` group; beforeChange invariant). Test: `tests/collections/forms.access.test.ts` is access-only; add a small pure validator test instead.

- [ ] **Step 1:** Extract the children-model invariant into a pure exported helper in `src/lib/registration-fields.ts`:

```ts
import type { FormSchema } from './form-schema'
/** A children-model registration form must contain exactly one repeatable-group (the participant section). */
export function hasParticipantGroup(schema: FormSchema): boolean {
  const groups = schema.steps.flatMap((s) => s.fields).filter((f) => f.type === 'repeatable-group')
  return groups.length === 1
}
```

- [ ] **Step 2:** Add tests in `tests/lib/registration-fields.test.ts` for `hasParticipantGroup` (true with one group, false with zero/two). Run — FAIL — implement (Step 1) — PASS.

- [ ] **Step 3:** In `src/collections/Forms.ts`, add a `registration` group field near `registrationProgram`:

```ts
{
  name: 'registration', type: 'group', admin: { condition: (_, sib) => sib?.schoolRegistration === true },
  fields: [
    { name: 'participantModel', type: 'select', defaultValue: 'children',
      options: [ { label: 'Children (guardian registers ≥1 child)', value: 'children' }, { label: 'Self (an adult registers themselves)', value: 'self' } ] },
  ],
},
```

In the beforeChange hook (lines ~61-73), when `schoolRegistration === true` and `registration.participantModel === 'children'`, also require `hasParticipantGroup(parsedSchema)` (throw a clear error otherwise). Keep the existing `hasRequiredRegistrationFields` check applying to the participant group's child fields for the children model.

- [ ] **Step 4:** `npx tsc --noEmit`; manual: builder rejects saving a children-registration form without a participant group. Commit:

```bash
git add src/collections/Forms.ts src/lib/registration-fields.ts tests/lib/registration-fields.test.ts
git commit -m "feat(forms): registration participantModel + require a participant group for children forms"
```

---

## Task 3: Participant → students mapper + auto-enroll helpers (pure, TDD)

**Files:** Create `src/lib/school-enroll.ts`; Test `tests/lib/school-enroll.test.ts`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { participantsFromSubmission, mapParticipantToStudent } from '@/lib/school-enroll'

describe('participantsFromSubmission', () => {
  it('returns the participants array for children forms', () => {
    const out = participantsFromSubmission({ guardian_name: 'R', participants: [{ student_first_name: 'A', student_last_name: 'B' }] }, 'participants')
    expect(out.length).toBe(1)
  })
  it('wraps top-level fields as a single participant for self forms (null groupKey)', () => {
    const out = participantsFromSubmission({ student_first_name: 'Adam', student_last_name: 'X' }, null)
    expect(out.length).toBe(1)
    expect(out[0].student_first_name).toBe('Adam')
  })
})

describe('mapParticipantToStudent', () => {
  it('maps a participant + shared guardian into student create data', () => {
    const r = mapParticipantToStudent(
      { student_first_name: 'Aisha', student_last_name: 'Abbasi', student_grade: '3' },
      { guardian_name: 'Mr Abbasi', guardian_phone: '847-555-0190', guardian_email: 'a@b.com' },
      1, 7,
    )
    expect(r).toMatchObject({ tenant: 1, firstName: 'Aisha', lastName: 'Abbasi', gradeLevel: '3', status: 'active', registeredProgram: 7 })
    expect((r!.guardians as any[])[0]).toMatchObject({ name: 'Mr Abbasi', phone: '847-555-0190', email: 'a@b.com', isPrimary: true })
  })
  it('returns null without first+last name', () => {
    expect(mapParticipantToStudent({ student_first_name: 'A' }, {}, 1, null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement `src/lib/school-enroll.ts`** (reuse the `str` pattern; `mapParticipantToStudent` mirrors today's `mapRegistrationFields` but reads per-participant fields + a shared guardian object):

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (d: Record<string, unknown>, k: string): string | undefined => {
  const v = d[k]; if (v == null) return undefined; const s = String(v).trim(); return s.length ? s : undefined
}

export function participantsFromSubmission(data: Record<string, unknown>, groupKey: string | null): Record<string, unknown>[] {
  if (groupKey && Array.isArray(data[groupKey])) return data[groupKey] as Record<string, unknown>[]
  return [data] // self model: the submission itself is the single participant
}

export function mapParticipantToStudent(
  p: Record<string, unknown>, guardian: Record<string, unknown>, tenantId: string | number, programId: string | number | null,
): Record<string, unknown> | null {
  const firstName = str(p, 'student_first_name'); const lastName = str(p, 'student_last_name')
  if (!firstName || !lastName) return null
  const result: Record<string, unknown> = { tenant: tenantId, firstName, lastName, status: 'active' }
  const ageRaw = p['student_age']; if (ageRaw != null && !Number.isNaN(Number(ageRaw))) result.age = Number(ageRaw)
  const grade = str(p, 'student_grade') ?? str(p, 'grade'); if (grade) result.gradeLevel = grade
  const allergies = str(p, 'allergies'); if (allergies) result.allergiesNotes = allergies
  const gName = str(guardian, 'guardian_name')
  if (gName) {
    const g: Record<string, unknown> = { name: gName, isPrimary: true }
    const ph = str(guardian, 'guardian_phone'); if (ph) g.phone = ph
    const em = str(guardian, 'guardian_email'); if (em) g.email = em
    result.guardians = [g]
  }
  if (programId != null) result.registeredProgram = programId
  return result
}
```

- [ ] **Step 4: Run — PASS. Commit.**

```bash
git add src/lib/school-enroll.ts tests/lib/school-enroll.test.ts
git commit -m "feat(school): pure participant→student mapper + participant extraction"
```

---

## Task 4: `createStudentFromRegistration` — create N students + single-class auto-enroll + default class

**Files:** Modify `src/hooks/createStudentFromRegistration.ts`; Test extend `tests/hooks/createStudentFromRegistration.test.ts` (the hook itself is integration-ish; keep the pure mappers in `school-enroll` unit-tested, and test the auto-enroll resolver purely).

- [ ] **Step 1:** Add a pure resolver to `src/lib/school-enroll.ts` + test in `tests/lib/school-enroll.test.ts`:

```ts
/** When a program has exactly one active class, return its id (auto-enroll target); else null. */
export function resolveAutoEnrollClassId(activeClassIds: (string | number)[]): string | number | null {
  return activeClassIds.length === 1 ? activeClassIds[0] : null
}
```

Test: one class → that id; zero or ≥2 → null. FAIL → implement → PASS.

- [ ] **Step 2:** Rewrite the hook body (keep `buildRegistrationDetails`): after loading the form + resolving `programId`, determine the participant group key from the schema (the single `repeatable-group`'s `name`, or null for self), then:

```ts
const groupKey = (form.registration?.participantModel === 'children')
  ? (schemaGroups(form.schema)[0]?.name ?? null) : null
const participants = participantsFromSubmission(submissionData, groupKey)

// Resolve the program's active classes once (for single-class auto-enroll / default class).
let activeClassIds = await findActiveClassIds(req.payload, tenantId, programId) // helper using payload.find
if (programId && activeClassIds.length === 0) {
  const def = await req.payload.create({ collection: 'school-classes', overrideAccess: true, req,
    data: { tenant: tenantId, term: programId, name: form.title ?? 'General', status: 'active' } })
  activeClassIds = [def.id]
}
const autoClassId = resolveAutoEnrollClassId(activeClassIds)

for (const p of participants) {
  const studentData = mapParticipantToStudent(p, submissionData, tenantId, programId)
  if (!studentData) continue
  studentData.registrationDetails = buildRegistrationDetails({ ...submissionData, ...p }, form.schema, form.title ?? form.name ?? null)
  const student = await req.payload.create({ collection: 'students', data: studentData, overrideAccess: true, req })
  if (autoClassId != null) {
    await req.payload.create({ collection: 'enrollments', overrideAccess: true, req,
      data: { tenant: tenantId, student: student.id, class: autoClassId, status: 'active' } })
  }
}
```

(`schemaGroups` returns the `repeatable-group` fields; `findActiveClassIds` does `payload.find({collection:'school-classes', where:{ and:[{tenant},{term:programId},{status:'active'}] }, depth:0, overrideAccess:true})`. Keep `mapRegistrationFields` exported for back-compat/tests but route the hook through the new path.)

- [ ] **Step 3:** `npx vitest run tests/lib/school-enroll.test.ts tests/hooks/createStudentFromRegistration.test.ts` — PASS. `npx tsc --noEmit`. Manual: submit a children form with 2 kids → 2 students created; single-class program → both auto-enrolled; multi-class → both land in the Enrollment hub queue.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/createStudentFromRegistration.ts src/lib/school-enroll.ts tests/lib/school-enroll.test.ts
git commit -m "feat(school): registration creates N students, single-class auto-enroll, default class"
```

---

## Task 5: Builder UI — author/edit a repeatable group + section

**Files:** `src/admin/forms/builder/AddFieldPopover.tsx` (`FIELD_DESCRIPTIONS` entries for `section`, `repeatable-group`), `FieldTypeIcon.tsx` (icons), `FieldCard.tsx` (`FieldPreview` branches), `PropertiesDrawer.tsx` (group props: `itemLabel`, `min`, `max`; section props: `label`), `FormBuilderField.client.tsx` (mutators + DnD).

This is the largest UI task. Contract: a `repeatable-group` renders as a card containing its child `fields[]` with their own Add/edit/delete affordances (one nesting level only); the DnD `buildFieldStepMap` and mutators must handle a field path of `{stepIndex, groupFieldId?, fieldId}`.

- [ ] **Step 1:** Add `FIELD_DESCRIPTIONS['section']` and `['repeatable-group']` (TS requires every `FieldTypeId` key).
- [ ] **Step 2:** Add `makeDefaultField` branches: `section` → `{type:'section', id, name, label:'Section'}`; `repeatable-group` → `{type:'repeatable-group', id, name, label:'Children', itemLabel:'Child', min:1, fields:[]}`.
- [ ] **Step 3:** `FieldPreview` + `FieldTypeIcon` branches for both. The group preview renders its child fields recursively (reuse `FieldPreview`).
- [ ] **Step 4:** Mutators: extend `addField`/`updateField`/`deleteField`/`duplicateField` to accept an optional `groupFieldId` so child fields are inserted/edited within a group's `fields[]`. DnD: extend `buildFieldStepMap` to record group membership; restrict child drags within their group.
- [ ] **Step 5:** `PropertiesDrawer`: for `repeatable-group` show `itemLabel`/`min`/`max` inputs; for `section` show `label`.
- [ ] **Verify:** `npx tsc --noEmit`, `npm run lint`, manual: add a "Children" repeatable group, add child fields, save; reorder within the group.
- [ ] **Commit:** `git commit -m "feat(forms): build/edit repeatable groups and sections in the form builder"`

---

## Task 6: Public renderer — repeatable group add/remove + nested values

**Files:** `src/components/PublicFormFields.tsx` (render branches), `src/app/(forms)/forms/[slug]/PublicFormClient.tsx` (nested value state + validation).

Contract: `values[groupName]` is an array of item value-maps. The group renders each item with its child inputs + a "Remove" button and an "Add another {itemLabel}" button (respecting `min`/`max`). Item-field changes call `onGroupChange(groupName, index, childName, value)`.

- [ ] **Step 1:** `PublicFormFields`: add a `repeatable-group` branch that maps `(values[f.name] ?? [{}])` to item cards rendering `f.fields` via the existing `renderControl`, wired to a new `onGroupChange` prop; add/remove buttons. `section` renders a heading + its grouping (visual only).
- [ ] **Step 2:** `PublicFormClient`: initialize `values[groupName] = [{}]` for groups; implement `onGroupChange`, `addItem`, `removeItem`; extend `validateStep` to validate group items (required child fields, min count); the submit `body` already spreads `values`, so `participants` rides along as a nested array.
- [ ] **Verify:** `npx tsc --noEmit`, `npm run lint`, manual: fill a 2-child registration, submit, confirm 2 students created (Task 4) and the submission `data.participants` has 2 entries.
- [ ] **Commit:** `git commit -m "feat(forms): public form renders repeatable groups (add/remove items, nested submission)"`

---

## Task 7: Teach compat readers about the nested participants key

**Files:** `src/lib/form-csv.ts`, `src/lib/form-notifications.ts`, `src/lib/submissions-table.ts`, `src/admin/forms/submissions/SubmissionDrawer.tsx`, `src/lib/form-schema-migrate.ts`.

Strategy: when building columns/summaries from the schema, **expand** a `repeatable-group` into per-item columns (e.g. `participants[0].student_first_name`) or render a readable multi-line summary; never `[object Object]`.

- [ ] **Step 1 (CSV, pure → TDD):** In `src/lib/form-csv.ts`, when a schema field is a `repeatable-group`, emit one column per (max items seen, child field) or a single JSON/`;`-joined column. Add a test in `tests/lib/form-csv.test.ts` with a nested submission asserting the participant values appear (not blank). FAIL → implement → PASS.
- [ ] **Step 2 (notifications, pure → TDD):** In `src/lib/form-notifications.ts`, render group items as indented sub-lines. Add a `tests/lib/form-notifications.test.ts` case. FAIL → implement → PASS.
- [ ] **Step 3 (submissions table):** In `src/lib/submissions-table.ts` `buildColumnSpecs`/`getCellValue`, expand groups into per-item column specs (id `field:participants.0.student_first_name`) or a count + drill-in. Update `src/lib/submissions-table.test.ts`. Run.
- [ ] **Step 4 (drawer):** `SubmissionDrawer.tsx` — render the participants array as a list. (`tsc`/manual.)
- [ ] **Step 5 (rename migration):** `form-schema-migrate.ts` `applyRenames` — descend into group child fields when re-keying. Update `src/lib/form-schema-migrate.test.ts`. Run.
- [ ] **Commit:** `git commit -m "feat(forms): CSV/notifications/table/drawer/migration handle repeatable groups"`

---

## Task 8: Full verification

- [ ] `npm run test` (all pass), `npm run lint` (clean), `npx tsc --noEmit` (0 errors).
- [ ] Manual smoke: build a children-registration form (guardian section + "Children" repeatable group with first/last/grade); publish; register a family of 2 from `/forms/<slug>`; confirm 2 students + correct placement (auto-enroll if single class, else queue); CSV export and the email summary show both children; the submissions table shows the data.
- [ ] `git push origin HEAD`

---

## Self-review (run before executing)
- **Spec coverage:** participant model (children/self) ✔ (Tasks 2,3,4); repeatable sections ✔ (1,5,6); N students ✔ (4); single-class auto-enroll + default class ✔ (4); configurable sections/fields ✔ (1,5,6). Payment models = Phase 3 (out of scope here).
- **Type consistency:** group key is the single `repeatable-group`'s `name`; `participantsFromSubmission(data, groupKey)`/`mapParticipantToStudent(p, guardian, tenant, program)`/`resolveAutoEnrollClassId(ids)` used consistently in Task 4.
- **Compat:** nested data confined to the reserved group key; readers updated in Task 7.

## Out of scope (Phase 3)
Payment models (free/one-time/**monthly recurring**), per-class/priced fields, family Stripe subscription, sibling discount, promo codes, the tuition record + webhook. See `2026-06-19-program-tuition-billing.md`.
