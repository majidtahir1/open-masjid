# School Registration Template + Typed Guardians Block — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make school-registration forms scaffold a typed (role-identified) Guardians block so each child's `student.guardians[].phone` is reliably populated and the check-in kiosk can match parents by phone.

**Architecture:** Add an optional `role` to form-schema fields (the contract; label stays cosmetic). A guardians repeatable-group carries `role: 'guardians'` with role-tagged children. Participant-group resolution becomes role-aware (the single group whose role ≠ `guardians`) so the two groups coexist. The student materializer reads guardians by role and writes multiple guardians with normalized phones. The "template" is delivered by extending the builder's existing `schoolRegistration`-toggle seeding to also seed the Guardians group. Forward-only; no backfill.

**Tech Stack:** Next.js 16, Payload CMS 3.x, Vitest, Zod, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-22-school-registration-template-design.md`

---

## File structure

- `src/lib/phone.ts` — **new** — shared `normalizePhone` (extracted from kiosk).
- `src/lib/checkin/kiosk.ts` — re-export `normalizePhone` from `@/lib/phone` (no behavior change).
- `src/lib/form-schema.ts` — add optional `role` to leaf fields + repeatable-group.
- `src/lib/registration-fields.ts` — guardian role constants; role-aware `participantGroupName`; `guardiansGroupName`; role-aware `hasParticipantGroup` + `ensureParticipantGroupFields`; new `ensureGuardiansGroup`; `validateGuardians`.
- `src/lib/school-enroll.ts` — `guardiansFromSubmission`; multi-guardian, role-based `mapParticipantToStudent`.
- `src/hooks/createStudentFromRegistration.ts` — resolve guardians once, pass to mapper; use role-aware participant group.
- `src/app/api/forms/[slug]/submit/route.ts` — use role-aware participant group for pricing.
- `src/app/(forms)/forms/[slug]/PublicFormClient.tsx` — `findParticipantGroup` excludes guardians group.
- `src/lib/form-submit.ts` — call `validateGuardians` after schema validation.
- `src/admin/forms/FormBuilderField.client.tsx` — extend seeding effect to seed the Guardians group.
- Tests under `tests/lib/`, `tests/hooks/`.

---

## Task 1: Shared phone normalization

**Files:**
- Create: `src/lib/phone.ts`
- Modify: `src/lib/checkin/kiosk.ts` (the `normalizePhone` definition)
- Test: `tests/lib/phone.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/phone.test.ts
import { describe, it, expect } from 'vitest'
import { normalizePhone } from '@/lib/phone'

describe('normalizePhone', () => {
  it('strips non-digits and keeps the last 10 digits', () => {
    expect(normalizePhone('(999) 000-0000')).toBe('9990000000')
    expect(normalizePhone('+1 999 000 0000')).toBe('9990000000')
  })
  it('returns digits as-is when 10 or fewer', () => {
    expect(normalizePhone('555-1234')).toBe('5551234')
  })
  it('tolerates null/undefined', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/phone.test.ts`
Expected: FAIL — cannot resolve `@/lib/phone`.

- [ ] **Step 3: Create the shared module**

```ts
// src/lib/phone.ts
/** Normalize a phone to comparable digits: strip non-digits, keep last 10.
 *  Shared by the check-in kiosk (match time) and student materialization
 *  (store time) so the two can never drift. */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}
```

- [ ] **Step 4: Re-export from kiosk to avoid drift**

In `src/lib/checkin/kiosk.ts`, replace the existing `normalizePhone` function definition:

```ts
export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}
```

with a re-export:

```ts
export { normalizePhone } from '@/lib/phone'
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/lib/phone.test.ts && npx tsc --noEmit`
Expected: PASS; tsc exit 0. (`src/lib/checkin/data.ts` imports `normalizePhone` from `./kiosk` — still resolves.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/phone.ts src/lib/checkin/kiosk.ts tests/lib/phone.test.ts
git commit -m "refactor(phone): extract shared normalizePhone used by kiosk + materializer"
```

---

## Task 2: Add optional `role` to schema fields

**Files:**
- Modify: `src/lib/form-schema.ts` (`FieldBase`, repeatable-group member)
- Test: `tests/lib/form-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// add to tests/lib/form-schema.test.ts
describe('field role', () => {
  it('accepts a role on a leaf field and a guardians role on a group', () => {
    const r = validateSchema({
      steps: [{ id: 's1', fields: [
        { type: 'phone', id: 'p1', name: 'g_phone', label: 'Phone', role: 'guardian_phone' },
        { type: 'repeatable-group', id: 'g1', name: 'guardians', label: 'Guardians', role: 'guardians',
          fields: [{ type: 'short-text', id: 'n1', name: 'g_name', label: 'Name', role: 'guardian_name' }] },
      ]}],
    })
    expect(r.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/form-schema.test.ts -t "field role"`
Expected: FAIL — zod strips/rejects unknown `role` (validateSchema parses with the strict members; the round-trip won't carry `role`, and the group member has no `role`).

- [ ] **Step 3: Add `role` to FieldBase and the group member**

In `src/lib/form-schema.ts`, add `role` to `FieldBase` (covers all leaf members, which spread `FieldBase`):

```ts
const FieldBase = {
  id: z.string().min(1),
  name: z.string().regex(FieldNameRegex),
  label: z.string().min(1),
  required: z.boolean().default(false),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  role: z.string().optional(),
}
```

Add `role` to the `class-select` member (it does NOT spread `FieldBase`):

```ts
  z.object({
    type: z.literal('class-select'),
    id: z.string().min(1),
    name: z.string().regex(FieldNameRegex),
    label: z.string().optional(),
    required: z.boolean().default(false),
    helpText: z.string().optional(),
    role: z.string().optional(),
  }),
```

Add `role` to the repeatable-group member in `FieldSchema`:

```ts
  z.object({
    type: z.literal('repeatable-group'),
    id: z.string().min(1),
    name: z.string().regex(FieldNameRegex),
    label: z.string().optional(),
    itemLabel: z.string().optional(),
    role: z.string().optional(),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(1).optional(),
    fields: z.array(LeafFieldSchema).min(1),
  }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/form-schema.test.ts`
Expected: PASS (all existing schema tests + the new one).

- [ ] **Step 5: Commit**

```bash
git add src/lib/form-schema.ts tests/lib/form-schema.test.ts
git commit -m "feat(form-schema): optional role on leaf fields and repeatable-group"
```

---

## Task 3: Guardian role constants, role-aware participant group, guardians group + seed

**Files:**
- Modify: `src/lib/registration-fields.ts`
- Test: `tests/lib/registration-fields.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// add to tests/lib/registration-fields.test.ts
import {
  GUARDIANS_GROUP_ROLE, GUARDIAN_ROLES,
  participantGroupName, guardiansGroupName, ensureGuardiansGroup, hasParticipantGroup,
} from '@/lib/registration-fields'
import type { FormSchema } from '@/lib/form-schema'

const makeId = (() => { let n = 0; return () => `id-${++n}` })

describe('role-aware participant + guardians groups', () => {
  const withBoth: FormSchema = { steps: [{ id: 's1', fields: [
    { type: 'repeatable-group', id: 'p', name: 'participants', label: 'Children', min: 1,
      fields: [{ type: 'short-text', id: 'a', name: 'student_first_name', label: 'First', required: true }] },
    { type: 'repeatable-group', id: 'g', name: 'guardians', label: 'Guardians', role: 'guardians', min: 1,
      fields: [{ type: 'short-text', id: 'b', name: 'g_name', label: 'Name', role: 'guardian_name', required: true }] },
  ]}] }

  it('participantGroupName ignores the guardians group', () => {
    expect(participantGroupName(withBoth)).toBe('participants')
  })
  it('guardiansGroupName finds the guardians-role group', () => {
    expect(guardiansGroupName(withBoth)).toBe('guardians')
  })
  it('hasParticipantGroup is true with exactly one non-guardians group', () => {
    expect(hasParticipantGroup(withBoth)).toBe(true)
  })
  it('ensureGuardiansGroup appends a role-tagged guardians group when missing', () => {
    const base: FormSchema = { steps: [{ id: 's1', fields: [] }] }
    const next = ensureGuardiansGroup(base, makeId())
    const g = next.steps.flatMap((s) => s.fields).find((f: any) => f.role === GUARDIANS_GROUP_ROLE) as any
    expect(g).toBeTruthy()
    expect(g.type).toBe('repeatable-group')
    const roles = g.fields.map((c: any) => c.role)
    expect(roles).toContain(GUARDIAN_ROLES.name)
    expect(roles).toContain(GUARDIAN_ROLES.phone)
  })
  it('ensureGuardiansGroup is idempotent', () => {
    const g1 = ensureGuardiansGroup({ steps: [{ id: 's1', fields: [] }] }, makeId())
    const g2 = ensureGuardiansGroup(g1, makeId())
    expect(g2).toBe(g1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/registration-fields.test.ts -t "role-aware"`
Expected: FAIL — new exports do not exist.

- [ ] **Step 3: Add constants, role-aware resolvers, and the seed helper**

In `src/lib/registration-fields.ts`, add near the top (after imports):

```ts
export const GUARDIANS_GROUP_ROLE = 'guardians' as const
export const GUARDIAN_ROLES = {
  name: 'guardian_name',
  phone: 'guardian_phone',
  email: 'guardian_email',
  relationship: 'guardian_relationship',
} as const

/** The single repeatable-group that is NOT the guardians group (the participants
 *  section). Backward-compatible: forms without a guardians group resolve to
 *  their only repeatable-group, exactly as before. */
export function participantGroupName(schema: FormSchema): string | null {
  const groups = schema.steps
    .flatMap((s) => s.fields)
    .filter((f) => f.type === 'repeatable-group' && f.role !== GUARDIANS_GROUP_ROLE)
  return groups.length === 1 ? (groups[0] as { name: string }).name : null
}

/** Name of the guardians-role repeatable-group, or null. */
export function guardiansGroupName(schema: FormSchema): string | null {
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'repeatable-group' && f.role === GUARDIANS_GROUP_ROLE) return f.name
    }
  }
  return null
}
```

Replace the existing `hasParticipantGroup`:

```ts
/** A children-model registration form must contain exactly one participant
 *  (non-guardians) repeatable-group. */
export function hasParticipantGroup(schema: FormSchema): boolean {
  return participantGroupName(schema) !== null
}
```

Add the seed helper (place after `ensureParticipantGroupFields`):

```ts
/** Ensure a typed Guardians repeatable-group exists (role-tagged, relabel-safe).
 *  Idempotent: returns the SAME reference when a guardians group already exists.
 *  Appends to the last step so it renders after the participants section. */
export function ensureGuardiansGroup(schema: FormSchema, makeId: () => string): FormSchema {
  if (guardiansGroupName(schema)) return schema
  const group = {
    type: 'repeatable-group' as const,
    id: makeId(),
    name: 'guardians',
    label: 'Guardians',
    itemLabel: 'Guardian',
    role: GUARDIANS_GROUP_ROLE,
    min: 1,
    fields: [
      { type: 'short-text' as const, id: makeId(), name: 'guardian_name', label: 'Name', required: true, role: GUARDIAN_ROLES.name },
      { type: 'phone' as const, id: makeId(), name: 'guardian_phone', label: 'Phone', required: false, role: GUARDIAN_ROLES.phone },
      { type: 'email' as const, id: makeId(), name: 'guardian_email', label: 'Email', required: false, role: GUARDIAN_ROLES.email },
      { type: 'short-text' as const, id: makeId(), name: 'guardian_relationship', label: 'Relationship', required: false, role: GUARDIAN_ROLES.relationship },
    ],
  }
  const steps = schema.steps.length > 0
    ? schema.steps.map((s, i) => (i === schema.steps.length - 1 ? { ...s, fields: [...s.fields, group] } : s))
    : [{ id: makeId(), fields: [group] }]
  return { ...schema, steps }
}
```

- [ ] **Step 4: Make `ensureParticipantGroupFields` role-aware (exclude guardians group)**

In `ensureParticipantGroupFields`, change the group-detection loop so it counts only non-guardians groups. Replace the block that increments `groupCount` / records indices:

```ts
  schema.steps.forEach((step, si) => {
    step.fields.forEach((f, fi) => {
      if (f.type === 'repeatable-group' && f.role !== GUARDIANS_GROUP_ROLE) {
        groupCount += 1
        groupStepIndex = si
        groupFieldIndex = fi
      }
    })
  })
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/lib/registration-fields.test.ts && npx tsc --noEmit`
Expected: PASS; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/registration-fields.ts tests/lib/registration-fields.test.ts
git commit -m "feat(registration): role-aware participant group + ensureGuardiansGroup"
```

---

## Task 4: Route participant-group lookups through the role-aware helper

**Files:**
- Modify: `src/hooks/createStudentFromRegistration.ts` (`schemaGroups(...)[0]` usage)
- Modify: `src/app/api/forms/[slug]/submit/route.ts` (`schemaGroups(...)[0]` usage)
- Modify: `src/app/(forms)/forms/[slug]/PublicFormClient.tsx` (`findParticipantGroup`)
- Test: `tests/hooks/createStudentFromRegistration.test.ts` (existing — must stay green)

- [ ] **Step 1: createStudentFromRegistration — use participantGroupName**

In `src/hooks/createStudentFromRegistration.ts`, find the participant-group resolution:

```ts
  const groupKey =
    form.registration?.participantModel === 'children'
      ? (schemaGroups(form.schema)[0]?.name ?? null)
      : null
```

Replace with the role-aware helper (add `participantGroupName` to the existing `@/lib/registration-fields` import, or import it):

```ts
  const groupKey =
    form.registration?.participantModel === 'children'
      ? participantGroupName(form.schema as FormSchema)
      : null
```

Ensure the file imports: `import { participantGroupName } from '@/lib/registration-fields'` and `import type { FormSchema } from '@/lib/form-schema'` (if not already present). Leave the local `schemaGroups` helper if still used elsewhere; otherwise remove it.

- [ ] **Step 2: submit route — use participantGroupName**

In `src/app/api/forms/[slug]/submit/route.ts`, in `resolveRegistrationPricing`, replace:

```ts
  const groupKey =
    form.registration?.participantModel === 'children'
      ? (schemaGroups(form.schema)[0]?.name ?? null)
      : null
```

with:

```ts
  const groupKey =
    form.registration?.participantModel === 'children'
      ? participantGroupName(form.schema as FormSchema)
      : null
```

Add `participantGroupName` to the `@/lib/registration-fields` import. If `schemaGroups` is now unused in this file, remove its definition.

- [ ] **Step 3: PublicFormClient — exclude guardians group from the participant lookup**

In `src/app/(forms)/forms/[slug]/PublicFormClient.tsx`, update `findParticipantGroup` to skip the guardians group:

```ts
function findParticipantGroup(schema: FormSchema): Extract<Field, { type: 'repeatable-group' }> | null {
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'repeatable-group' && f.role !== 'guardians') return f
    }
  }
  return null
}
```

- [ ] **Step 4: Run the affected suites + typecheck**

Run: `npx vitest run tests/hooks/createStudentFromRegistration.test.ts tests/api/forms.submit.test.ts && npx tsc --noEmit`
Expected: PASS; tsc exit 0 (existing tests have no guardians group → participantGroupName returns the only group, unchanged behavior).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/createStudentFromRegistration.ts "src/app/api/forms/[slug]/submit/route.ts" "src/app/(forms)/forms/[slug]/PublicFormClient.tsx"
git commit -m "refactor(registration): resolve participant group by role (exclude guardians)"
```

---

## Task 5: Multi-guardian, role-based mapping

**Files:**
- Modify: `src/lib/school-enroll.ts`
- Test: `tests/lib/school-enroll.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// add to tests/lib/school-enroll.test.ts
import { guardiansFromSubmission, mapParticipantToStudent } from '@/lib/school-enroll'
import type { FormSchema } from '@/lib/form-schema'

const schemaWithGuardians: FormSchema = { steps: [{ id: 's1', fields: [
  { type: 'repeatable-group', id: 'g', name: 'guardians', label: 'Guardians', role: 'guardians', min: 1, fields: [
    { type: 'short-text', id: 'n', name: 'g_name', label: 'Name', required: true, role: 'guardian_name' },
    { type: 'phone', id: 'p', name: 'g_phone', label: 'Phone', role: 'guardian_phone' },
    { type: 'email', id: 'e', name: 'g_email', label: 'Email', role: 'guardian_email' },
    { type: 'short-text', id: 'r', name: 'g_rel', label: 'Rel', role: 'guardian_relationship' },
  ]},
]}] }

describe('guardiansFromSubmission', () => {
  it('reads guardians by role, normalizes phone, marks first primary', () => {
    const data = { guardians: [
      { g_name: 'Parent One', g_phone: '(999) 000-0000', g_email: 'a@b.com', g_rel: 'Mother' },
      { g_name: 'Parent Two', g_phone: '111-222-3333' },
    ]}
    const g = guardiansFromSubmission(schemaWithGuardians, data)
    expect(g).toEqual([
      { name: 'Parent One', phone: '9990000000', email: 'a@b.com', relationship: 'Mother', isPrimary: true },
      { name: 'Parent Two', phone: '1112223333', isPrimary: false },
    ])
  })
  it('returns [] when there is no guardians group', () => {
    const data = { guardian_name: 'X', guardian_phone: '5551234' }
    expect(guardiansFromSubmission({ steps: [{ id: 's1', fields: [] }] }, data)).toEqual([])
  })
})

describe('mapParticipantToStudent with explicit guardians', () => {
  it('assigns the provided guardians array to the student', () => {
    const guardians = [{ name: 'Parent One', phone: '9990000000', isPrimary: true }]
    const s = mapParticipantToStudent(
      { student_first_name: 'Bob', student_last_name: 'Smith' }, {}, 1, 2, guardians,
    )
    expect(s?.guardians).toEqual(guardians)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/school-enroll.test.ts -t "guardiansFromSubmission"`
Expected: FAIL — `guardiansFromSubmission` not exported; `mapParticipantToStudent` has no 5th param.

- [ ] **Step 3: Implement `guardiansFromSubmission` and update the mapper**

In `src/lib/school-enroll.ts`, add imports at top:

```ts
import { normalizePhone } from './phone'
import { guardiansGroupName, GUARDIAN_ROLES } from './registration-fields'
import type { FormSchema, Field } from './form-schema'
```

Add the resolver:

```ts
export interface MappedGuardian {
  name: string
  phone?: string
  email?: string
  relationship?: string
  isPrimary: boolean
}

/** Resolve shared (per-submission) guardians from the typed guardians group,
 *  by ROLE (relabel-safe). Phones normalized to match the kiosk. Returns [] when
 *  the form has no guardians group. */
export function guardiansFromSubmission(schema: FormSchema, data: Record<string, unknown>): MappedGuardian[] {
  const groupName = guardiansGroupName(schema)
  if (!groupName) return []
  // Find the group's child role → field name map.
  let childFields: Field[] = []
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'repeatable-group' && f.name === groupName) childFields = f.fields as Field[]
    }
  }
  const byRole = (role: string): string | null => {
    const f = childFields.find((c) => 'role' in c && c.role === role)
    return f ? (f as { name: string }).name : null
  }
  const nameKey = byRole(GUARDIAN_ROLES.name)
  const phoneKey = byRole(GUARDIAN_ROLES.phone)
  const emailKey = byRole(GUARDIAN_ROLES.email)
  const relKey = byRole(GUARDIAN_ROLES.relationship)

  const items = Array.isArray(data[groupName]) ? (data[groupName] as Record<string, unknown>[]) : []
  const out: MappedGuardian[] = []
  items.forEach((item, i) => {
    const name = nameKey ? str(item, nameKey) : undefined
    if (!name) return
    const g: MappedGuardian = { name, isPrimary: i === 0 }
    const phone = phoneKey ? str(item, phoneKey) : undefined
    if (phone) g.phone = normalizePhone(phone)
    const email = emailKey ? str(item, emailKey) : undefined
    if (email) g.email = email
    const rel = relKey ? str(item, relKey) : undefined
    if (rel) g.relationship = rel
    out.push(g)
  })
  // Guarantee the first guardian is primary even if earlier ones were dropped.
  if (out.length && !out.some((g) => g.isPrimary)) out[0].isPrimary = true
  return out
}
```

Update `mapParticipantToStudent` to accept an optional pre-resolved guardians array, falling back to the legacy single-guardian read when none is provided (so existing forms keep working):

```ts
export function mapParticipantToStudent(
  p: Record<string, unknown>, guardian: Record<string, unknown>, tenantId: string | number, programId: string | number | null,
  guardians?: MappedGuardian[],
): Record<string, unknown> | null {
  const firstName = str(p, 'student_first_name'); const lastName = str(p, 'student_last_name')
  if (!firstName || !lastName) return null
  const result: Record<string, unknown> = { tenant: tenantId, firstName, lastName, status: 'active' }
  const ageRaw = p['student_age']; if (ageRaw != null && !Number.isNaN(Number(ageRaw))) result.age = Number(ageRaw)
  const grade = str(p, 'student_grade') ?? str(p, 'grade'); if (grade) result.gradeLevel = grade
  const allergies = str(p, 'allergies'); if (allergies) result.allergiesNotes = allergies
  if (guardians && guardians.length) {
    result.guardians = guardians
  } else {
    // Legacy fallback: single guardian by canonical name.
    const gName = str(guardian, 'guardian_name')
    if (gName) {
      const g: Record<string, unknown> = { name: gName, isPrimary: true }
      const ph = str(guardian, 'guardian_phone'); if (ph) g.phone = normalizePhone(ph)
      const em = str(guardian, 'guardian_email'); if (em) g.email = em
      result.guardians = [g]
    }
  }
  if (programId != null) result.registeredProgram = programId
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/school-enroll.test.ts && npx tsc --noEmit`
Expected: PASS; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/school-enroll.ts tests/lib/school-enroll.test.ts
git commit -m "feat(school-enroll): role-based multi-guardian mapping with normalized phones"
```

---

## Task 6: Wire guardians into the materializer call site

**Files:**
- Modify: `src/hooks/createStudentFromRegistration.ts` (the `mapParticipantToStudent` call ~line 207)
- Test: `tests/hooks/createStudentFromRegistration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// add to tests/hooks/createStudentFromRegistration.test.ts
// (Follow this file's existing payload-mock pattern; this asserts the created
//  student carries guardians[] resolved from the guardians group.)
it('materializes students with guardians from the typed guardians group', async () => {
  // Arrange a free (no payment) children-model form with a participants group +
  // a guardians group, and a submission with one guardian. Use the file's
  // existing mock harness for `payload` and `loadRegistrationForm`.
  // Assert: payload.create('students', ...) was called with data.guardians
  //         === [{ name: 'Parent One', phone: '9990000000', isPrimary: true }].
})
```

(Implement using the harness already present in this test file — same `vi.mock('payload')` / `findByID` dispatch the other cases use. Mirror an existing "free / unbound" case and add the guardians group to the mocked form schema + the guardian array to the submission data.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/hooks/createStudentFromRegistration.test.ts -t "guardians from the typed"`
Expected: FAIL — created student has no `guardians` (call site still passes only 4 args).

- [ ] **Step 3: Resolve guardians once and pass to the mapper**

In `src/hooks/createStudentFromRegistration.ts`, import the resolver:

```ts
import { participantGroupName } from '@/lib/registration-fields'
import { guardiansFromSubmission } from '@/lib/school-enroll'
```

After `submissionData` is computed and before the participant loop, resolve the shared guardians once:

```ts
  const guardians = guardiansFromSubmission(form.schema as FormSchema, submissionData)
```

Update the call site (currently `mapParticipantToStudent(p, submissionData, tenantId, programId)`):

```ts
    const studentData = mapParticipantToStudent(p, submissionData, tenantId, programId, guardians)
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/hooks/createStudentFromRegistration.test.ts && npx tsc --noEmit`
Expected: PASS; tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/createStudentFromRegistration.ts tests/hooks/createStudentFromRegistration.test.ts
git commit -m "feat(registration): materialize students with typed guardians"
```

---

## Task 7: Submit validation — primary guardian phone required

**Files:**
- Modify: `src/lib/registration-fields.ts` (`validateGuardians`)
- Modify: `src/lib/form-submit.ts` (call it after schema validation)
- Test: `tests/lib/registration-fields.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// add to tests/lib/registration-fields.test.ts
import { validateGuardians } from '@/lib/registration-fields'

describe('validateGuardians', () => {
  const schema: FormSchema = { steps: [{ id: 's1', fields: [
    { type: 'repeatable-group', id: 'g', name: 'guardians', label: 'Guardians', role: 'guardians', min: 1, fields: [
      { type: 'short-text', id: 'n', name: 'g_name', label: 'Name', required: true, role: 'guardian_name' },
      { type: 'phone', id: 'p', name: 'g_phone', label: 'Phone', role: 'guardian_phone' },
    ]},
  ]}] }
  it('requires the primary guardian phone', () => {
    const errs = validateGuardians(schema, { guardians: [{ g_name: 'A' }] })
    expect(errs['guardians.0.g_phone']).toBe('Required')
  })
  it('passes when the primary has a phone', () => {
    expect(validateGuardians(schema, { guardians: [{ g_name: 'A', g_phone: '5551234' }] })).toEqual({})
  })
  it('no guardians group → no errors', () => {
    expect(validateGuardians({ steps: [{ id: 's1', fields: [] }] }, {})).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/registration-fields.test.ts -t "validateGuardians"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement `validateGuardians`**

In `src/lib/registration-fields.ts`:

```ts
/** When a guardians group is present, the FIRST (primary) guardian must have a
 *  phone — that's what the check-in kiosk matches on. Other guardians optional.
 *  Returns field-keyed errors (empty when valid or no group). */
export function validateGuardians(schema: FormSchema, data: Record<string, unknown>): Record<string, string> {
  const groupName = guardiansGroupName(schema)
  if (!groupName) return {}
  let childFields: { name: string; role?: string }[] = []
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type === 'repeatable-group' && f.name === groupName) childFields = f.fields as never
    }
  }
  const phoneField = childFields.find((c) => c.role === GUARDIAN_ROLES.phone)
  if (!phoneField) return {}
  const items = Array.isArray(data[groupName]) ? (data[groupName] as Record<string, unknown>[]) : []
  const first = items[0]
  const v = first?.[phoneField.name]
  const present = v != null && String(v).trim().length > 0
  if (!present) return { [`${groupName}.0.${phoneField.name}`]: 'Required' }
  return {}
}
```

- [ ] **Step 4: Call it in submitForm**

In `src/lib/form-submit.ts`, replace the schema-validation block:

```ts
  // 3. Schema validation
  const v = validateSubmission(form.schema, data)
  if (!v.ok) return { ok: false, error: 'validation', errors: v.errors }
```

with:

```ts
  // 3. Schema validation (+ registration guardian rule)
  const v = validateSubmission(form.schema, data)
  if (!v.ok) return { ok: false, error: 'validation', errors: v.errors }
  const guardianErrors = validateGuardians(form.schema, data)
  if (Object.keys(guardianErrors).length) return { ok: false, error: 'validation', errors: guardianErrors }
```

Add the import at the top of `src/lib/form-submit.ts`:

```ts
import { validateGuardians } from './registration-fields'
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/lib/registration-fields.test.ts tests/lib/form-submit.test.ts tests/api/forms.submit.test.ts && npx tsc --noEmit`
Expected: PASS; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/registration-fields.ts src/lib/form-submit.ts tests/lib/registration-fields.test.ts
git commit -m "feat(registration): require primary guardian phone at submit"
```

---

## Task 8: Builder seeds the Guardians block (the template)

**Files:**
- Modify: `src/admin/forms/FormBuilderField.client.tsx` (the `schoolRegistration` seeding effect)

- [ ] **Step 1: Extend the seeding effect**

In `src/admin/forms/FormBuilderField.client.tsx`, update the import to include the new helper:

```ts
import { REGISTRATION_FIELD_DEFS, ensureGuardiansGroup, ensureParticipantGroupFields, ensureStudentFields, hasRequiredRegistrationFields } from '@/lib/registration-fields'
```

Replace the existing effect:

```ts
  useEffect(() => {
    if (!isSchoolReg || hasRequiredRegistrationFields(schema)) return
    if (participantModel === 'children') {
      const next = ensureParticipantGroupFields(schema, randomId)
      if (next !== schema) setValue(next)
    } else {
      setValue(ensureStudentFields(schema, randomId))
    }
  }, [isSchoolReg, participantModel, schema, setValue])
```

with a version that also seeds guardians (note: the guardians seed must NOT be gated by `hasRequiredRegistrationFields`, or it would never run once student fields exist):

```ts
  useEffect(() => {
    if (!isSchoolReg) return
    let next = schema
    if (!hasRequiredRegistrationFields(next)) {
      next = participantModel === 'children'
        ? ensureParticipantGroupFields(next, randomId)
        : ensureStudentFields(next, randomId)
    }
    // Typed Guardians block — the kiosk matches parents by guardians[].phone.
    next = ensureGuardiansGroup(next, randomId)
    if (next !== schema) setValue(next)
  }, [isSchoolReg, participantModel, schema, setValue])
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: tsc exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/admin/forms/FormBuilderField.client.tsx
git commit -m "feat(forms-builder): seed typed Guardians block on school registration"
```

---

## Task 9: End-to-end browser verification

**Files:** none (verification only). Use the project's running dev server (port 3000) and a Playwright check, mirroring prior verification runs in this repo. Demo creds in `.env` (`DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`); demo tenant at `demo.localhost:3000`.

- [ ] **Step 1: Builder scaffold**

Log into `demo.localhost:3000/admin`, create a new form, toggle **School registration** on (children model). Confirm the builder now shows a **Guardians** repeatable-group (Name/Phone/Email/Relationship) alongside the participant group. Relabel "Phone" → "Mobile" to confirm the role survives.

- [ ] **Step 2: Bind + publish**

Bind the form to a program (any active program/term), add at least one active class, publish.

- [ ] **Step 3: Submit as a parent**

Open the public form, add a child and a guardian (name + phone). Try submitting with the primary guardian phone blank → expect a "Required" error on that field. Fill it, submit.

- [ ] **Step 4: Verify the student + guardians in the DB**

```bash
DB=$(grep -E "^DATABASE_URI=" .env | cut -d= -f2- | tr -d '"')
/opt/homebrew/bin/psql "$DB" -c "select id, first_name, last_name, guardians from students where tenant_id=10 order by id desc limit 1;"
```
Expected: the new student row's `guardians` JSON contains the guardian with a normalized 10-digit `phone` and `isPrimary: true`.

- [ ] **Step 5: Kiosk match**

At the check-in kiosk for that program/tenant, enter the guardian's phone (in any format). Expect the child to appear in the family list (proves `findFamily` matches `guardians[].phone`).

- [ ] **Step 6: Full suite + lint + typecheck**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src/lib/phone.ts src/lib/registration-fields.ts src/lib/school-enroll.ts src/lib/form-submit.ts "src/admin/forms/FormBuilderField.client.tsx"
```
Expected: all green.

---

## Self-review notes

- **Spec coverage:** typed role contract (Tasks 2–3), template via builder seeding (Task 8), shared-per-submission multi-guardian mapping with normalized phone (Tasks 1, 5, 6), primary-phone-required submit validation (Task 7), kiosk unchanged but now matches (Task 1 keeps normalization shared; Task 9 verifies). No backfill, form-scaffold-only, no publish invariant — honored (nothing added for those).
- **Backward compatibility:** existing forms (no guardians group) → `participantGroupName` returns their only group; `guardiansFromSubmission`/`validateGuardians` return empty; `mapParticipantToStudent` falls back to the legacy single-guardian read. Existing tests must stay green (Tasks 4–7 run them).
- **Deviation from spec:** the "template" is delivered through the existing `schoolRegistration`-toggle seeding (Task 8) rather than a separate `registration-template.ts` + create route — simpler and consistent with the established pattern. Same outcome (one toggle → editable, role-typed scaffold).
