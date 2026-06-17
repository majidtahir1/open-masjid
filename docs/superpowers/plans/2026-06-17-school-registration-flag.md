# School Registration Form Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken slug/title naming convention for Sunday-school registration forms with an explicit `schoolRegistration` checkbox that instantly injects the two required student-name fields into the builder and drives the registration hook.

**Architecture:** A shared pure helper (`src/lib/registration-fields.ts`) is the single source of truth for the required fields; the form-builder client injects them on toggle, the Forms `beforeChange` guards their presence, and `createStudentFromRegistration` triggers on the flag and maps snake_case field names.

**Tech Stack:** Payload CMS 3.84, Next.js, React (`@payloadcms/ui` `useField`), Zod form schema, TypeScript, Vitest.

---

## Context the implementer needs

- **Form schema shape** (`src/lib/form-schema.ts`): a form's `schema` is `{ steps: [{ id, title?, fields: Field[] }] }`. Each non-page-break `Field` has `id` (stable), `name` (must match `^[a-z][a-z0-9_]*$` — lowercase + underscores), `label`, `required`, `type` (`short-text` etc.). Submission answers are keyed by field `name`. `validateSchema(input)` returns `{ success, schema }` or `{ success: false, error }` and enforces unique names.
- **The builder** (`src/admin/forms/FormBuilderField.client.tsx`) is the custom component for the `schema` field. It already reads sibling fields via `useField({ path: 'slug' })` / `{ path: 'tenant' }`, normalizes `value` into a local `schema`, and writes via `setValue(next)`. It has a `randomId()` helper.
- **The hook** (`src/hooks/createStudentFromRegistration.ts`) is a `FormSubmissions` afterChange. `doc.data` is a flat `Record<string, unknown>` keyed by field name; `doc.form` is the form id; `doc.tenant` the tenant. It currently keys off `REGISTRATION_MARKER` in the form slug/title and maps camelCase names (both wrong — replace).
- **Migrations are off auto-push**: adding the checkbox needs `npx payload migrate:create` then the user runs `npx payload migrate`. Vitest tests don't touch the DB.

---

## File Structure

```
src/lib/registration-fields.ts                  ← CREATE: pure REGISTRATION_FIELD_DEFS + ensureStudentFields + hasRequiredRegistrationFields
src/collections/Forms.ts                        ← MODIFY: schoolRegistration checkbox + beforeChange guard
src/admin/forms/FormBuilderField.client.tsx     ← MODIFY: watch flag, inject fields
src/hooks/createStudentFromRegistration.ts      ← MODIFY: trigger on flag, snake_case mapping
tests/lib/registration-fields.test.ts           ← CREATE
tests/hooks/createStudentFromRegistration.test.ts ← MODIFY (snake_case)
```

---

## Task 1: Pure registration-fields helper

**Files:**
- Create: `src/lib/registration-fields.ts`
- Test: `tests/lib/registration-fields.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/registration-fields.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ensureStudentFields, hasRequiredRegistrationFields, REGISTRATION_FIELD_DEFS } from '@/lib/registration-fields'
import type { FormSchema } from '@/lib/form-schema'

const empty: FormSchema = { steps: [{ id: 's1', fields: [] }] }
const counter = () => { let n = 0; return () => `gen-${++n}` }

describe('hasRequiredRegistrationFields', () => {
  it('false when missing', () => {
    expect(hasRequiredRegistrationFields(empty)).toBe(false)
  })
  it('true when both present', () => {
    const s = ensureStudentFields(empty, counter())
    expect(hasRequiredRegistrationFields(s)).toBe(true)
  })
})

describe('ensureStudentFields', () => {
  it('prepends both required fields to the first step', () => {
    const s = ensureStudentFields(empty, counter())
    const names = s.steps[0].fields.map((f) => (f as any).name)
    expect(names).toEqual(['student_first_name', 'student_last_name'])
    expect(s.steps[0].fields.every((f) => (f as any).type === 'short-text' && (f as any).required === true)).toBe(true)
  })
  it('is idempotent — no duplicates when already present', () => {
    const once = ensureStudentFields(empty, counter())
    const twice = ensureStudentFields(once, counter())
    expect(twice).toBe(once) // unchanged reference when nothing to add
    expect(twice.steps[0].fields.length).toBe(2)
  })
  it('adds only the missing one, preserving existing fields and order', () => {
    const partial: FormSchema = {
      steps: [{ id: 's1', fields: [
        { type: 'short-text', id: 'a', name: 'student_first_name', label: 'First', required: true },
        { type: 'email', id: 'b', name: 'email', label: 'Email', required: false },
      ] }],
    }
    const out = ensureStudentFields(partial, counter())
    const names = out.steps[0].fields.map((f) => (f as any).name)
    expect(names).toEqual(['student_last_name', 'student_first_name', 'email'])
  })
  it('assigns ids from the generator', () => {
    const out = ensureStudentFields(empty, counter())
    expect((out.steps[0].fields[0] as any).id).toBe('gen-1')
  })
})

describe('REGISTRATION_FIELD_DEFS', () => {
  it('declares the two student name fields', () => {
    expect(REGISTRATION_FIELD_DEFS.map((d) => d.name)).toEqual(['student_first_name', 'student_last_name'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/lib/registration-fields.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/lib/registration-fields.ts`:

```ts
import type { Field, FormSchema } from './form-schema'

/** Required student-name fields a Sunday-school registration form must have. */
export const REGISTRATION_FIELD_DEFS = [
  { name: 'student_first_name', label: 'Student first name' },
  { name: 'student_last_name', label: 'Student last name' },
] as const

function fieldNames(schema: FormSchema): Set<string> {
  const names = new Set<string>()
  for (const step of schema.steps) {
    for (const f of step.fields) {
      if (f.type !== 'page-break' && 'name' in f) names.add(f.name)
    }
  }
  return names
}

/** True iff both required student-name fields exist anywhere in the schema. */
export function hasRequiredRegistrationFields(schema: FormSchema): boolean {
  const names = fieldNames(schema)
  return REGISTRATION_FIELD_DEFS.every((d) => names.has(d.name))
}

/**
 * Return the schema with both required student-name fields present, prepended
 * to the first step. Idempotent: returns the SAME reference when nothing is
 * missing. `makeId` supplies stable field ids (injected so tests are
 * deterministic).
 */
export function ensureStudentFields(schema: FormSchema, makeId: () => string): FormSchema {
  const names = fieldNames(schema)
  const missing = REGISTRATION_FIELD_DEFS.filter((d) => !names.has(d.name))
  if (missing.length === 0) return schema

  const newFields: Field[] = missing.map(
    (d) => ({ type: 'short-text', id: makeId(), name: d.name, label: d.label, required: true }) as Field,
  )
  const steps = schema.steps.length > 0
    ? schema.steps.map((s, i) => (i === 0 ? { ...s, fields: [...newFields, ...s.fields] } : s))
    : [{ id: makeId(), fields: newFields }]
  return { ...schema, steps }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/lib/registration-fields.test.ts` → PASS. Then `npm test` (all pass) and `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/lib/registration-fields.ts tests/lib/registration-fields.test.ts
git commit -m "feat(forms): pure registration-fields helper"
```

---

## Task 2: Flag field + server guardrail on Forms

**Files:**
- Modify: `src/collections/Forms.ts`
- Migration: generated (file only; user applies)

- [ ] **Step 1: Add the checkbox field**

In `src/collections/Forms.ts`, add this field to the `fields` array (place it right after the `status` field so it sits in the sidebar near it):

```ts
    {
      name: 'schoolRegistration',
      type: 'checkbox',
      defaultValue: false,
      label: 'Sunday school registration form',
      admin: {
        position: 'sidebar',
        description: 'Submissions create an unplaced student you can place into a class.',
      },
    },
```

- [ ] **Step 2: Add the server guardrail to the existing beforeChange**

`Forms.ts` already has a `beforeChange` hook that validates `data.schema`. Import the helper at the top:

```ts
import { hasRequiredRegistrationFields } from '../lib/registration-fields'
```

Then change that validation hook so, after a successful `validateSchema`, it also enforces the registration fields. Replace the existing schema-validation hook body with:

```ts
    async ({ data }) => {
      if (data?.schema) {
        const r = validateSchema(data.schema)
        if (!r.success) throw new Error(`Invalid form schema: ${r.error}`)
        if (data.schoolRegistration === true && !hasRequiredRegistrationFields(r.schema)) {
          throw new Error('A registration form must keep the Student first name and Student last name fields.')
        }
      }
      return data
    },
```

(Keep `setTenantFromUser` as the first beforeChange entry and the afterChange rename hook unchanged.)

- [ ] **Step 3: Typecheck + generate types + migration file**

Run `npx tsc --noEmit` (clean), then `npm run generate:types` (expect `Form.schoolRegistration` in `src/payload-types.ts`).
Then `npx payload migrate:create form_school_registration` — inspect the generated file: it should only `ALTER TABLE "forms" ADD COLUMN "school_registration" boolean DEFAULT false`. Do NOT run `npx payload migrate` (the user applies it interactively).

- [ ] **Step 4: Run suite**

Run `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Forms.ts src/payload-types.ts src/migrations/
git commit -m "feat(forms): schoolRegistration flag + required-fields guardrail"
```

---

## Task 3: Instant field injection in the builder

**Files:**
- Modify: `src/admin/forms/FormBuilderField.client.tsx`

- [ ] **Step 1: Import the helpers**

At the top of `FormBuilderField.client.tsx`, add to the imports:

```ts
import { ensureStudentFields, hasRequiredRegistrationFields } from '@/lib/registration-fields'
```

`useEffect` and `useField` are already imported.

- [ ] **Step 2: Watch the flag and inject**

Inside `FormBuilderFieldClient`, after the existing `const schema: FormSchema = (() => { ... })()` block (so `schema` and `setValue` are in scope), add:

```ts
  // When the "Sunday school registration" flag is on, make sure the two
  // required student-name fields exist in the builder — injected instantly so
  // the admin sees them without saving. The guard makes this a no-op once the
  // fields are present, so it can't loop.
  const { value: isSchoolReg } = useField<boolean>({ path: 'schoolRegistration' })
  useEffect(() => {
    if (isSchoolReg && !hasRequiredRegistrationFields(schema)) {
      setValue(ensureStudentFields(schema, randomId))
    }
  }, [isSchoolReg, schema, setValue])
```

Note: `randomId` is the existing helper in this file. `setValue` comes from the existing `useField<FormSchema>` at the top. Place this effect with the other hooks (before the early `return`).

- [ ] **Step 3: Typecheck + build**

Run `npx tsc --noEmit` (clean). Then `npm run build` (run directly — no `timeout` on macOS) and confirm it compiles with no errors. Run `npm test` (all pass).

- [ ] **Step 4: Commit**

```bash
git add src/admin/forms/FormBuilderField.client.tsx
git commit -m "feat(forms): inject student fields when registration flag toggled on"
```

---

## Task 4: Rewire the registration hook to the flag + snake_case

**Files:**
- Modify: `src/hooks/createStudentFromRegistration.ts`
- Modify: `tests/hooks/createStudentFromRegistration.test.ts`

- [ ] **Step 1: Update the test to snake_case + flag**

Replace the contents of `tests/hooks/createStudentFromRegistration.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { mapRegistrationFields } from '@/hooks/createStudentFromRegistration'

describe('mapRegistrationFields', () => {
  it('maps snake_case fields to Student data', () => {
    const data = {
      student_first_name: 'Aisha',
      student_last_name: 'Khan',
      student_age: '7',
      guardian_name: 'Sara Khan',
      guardian_phone: '555-1212',
      guardian_email: 'sara@example.com',
      allergies: 'peanuts',
    }
    expect(mapRegistrationFields(data, 9)).toEqual({
      tenant: 9,
      firstName: 'Aisha',
      lastName: 'Khan',
      age: 7,
      allergiesNotes: 'peanuts',
      status: 'active',
      guardians: [{ name: 'Sara Khan', phone: '555-1212', email: 'sara@example.com', isPrimary: true }],
    })
  })
  it('requires both student name fields', () => {
    expect(mapRegistrationFields({ student_first_name: 'Aisha' }, 9)).toBeNull()
    expect(mapRegistrationFields({ student_last_name: 'Khan' }, 9)).toBeNull()
  })
  it('omits optional fields when absent', () => {
    const result = mapRegistrationFields({ student_first_name: 'Ali', student_last_name: 'Hassan' }, 9)
    expect(result).toMatchObject({ firstName: 'Ali', lastName: 'Hassan', tenant: 9, status: 'active' })
    expect(result).not.toHaveProperty('age')
    expect(result).not.toHaveProperty('allergiesNotes')
    expect(result).not.toHaveProperty('guardians')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/hooks/createStudentFromRegistration.test.ts` → FAIL (current code reads `firstName`/`lastName`).

- [ ] **Step 3: Update `mapRegistrationFields` to snake_case**

In `src/hooks/createStudentFromRegistration.ts`, change the body of `mapRegistrationFields` to read the snake_case keys (keep the existing `str()` helper and signature `(data: Record<string, unknown>, tenantId: string | number)`):

```ts
export function mapRegistrationFields(
  data: Record<string, unknown>,
  tenantId: string | number,
): Record<string, unknown> | null {
  const firstName = str(data, 'student_first_name')
  const lastName = str(data, 'student_last_name')
  if (!firstName || !lastName) return null

  const result: Record<string, unknown> = { tenant: tenantId, firstName, lastName, status: 'active' }

  const ageRaw = data['student_age']
  if (ageRaw != null) {
    const ageNum = Number(ageRaw)
    if (!Number.isNaN(ageNum)) result.age = ageNum
  }

  const allergies = str(data, 'allergies')
  if (allergies) result.allergiesNotes = allergies

  const guardianName = str(data, 'guardian_name')
  if (guardianName) {
    const guardian: Record<string, unknown> = { name: guardianName, isPrimary: true }
    const phone = str(data, 'guardian_phone')
    if (phone) guardian.phone = phone
    const email = str(data, 'guardian_email')
    if (email) guardian.email = email
    result.guardians = [guardian]
  }

  return result
}
```

- [ ] **Step 4: Switch the trigger from marker to flag**

In the same file, in the `createStudentFromRegistration` hook: delete the `REGISTRATION_MARKER` constant and the marker check. Load the form, then gate on the flag. Replace the form-lookup + marker block with:

```ts
  let form: { schoolRegistration?: boolean } | null = null
  try {
    form = (await req.payload.findByID({
      collection: 'forms',
      id: formId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as { schoolRegistration?: boolean } | null
  } catch {
    return doc
  }

  if (form?.schoolRegistration !== true) return doc
```

Keep the rest (read `doc.data`, resolve `tenantId`, `mapRegistrationFields`, create the student with `overrideAccess`, log on failure) unchanged.

- [ ] **Step 5: Run the test + suite + typecheck**

Run `npx vitest run tests/hooks/createStudentFromRegistration.test.ts` → PASS. Then `npm test` (all pass) and `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/createStudentFromRegistration.ts tests/hooks/createStudentFromRegistration.test.ts
git commit -m "feat(forms): drive registration hook from flag + snake_case fields"
```

---

## Task 5: Full verification

- [ ] **Step 1: Typecheck + suite + build**

Run `npx tsc --noEmit` → 0 errors. `npm test` → all pass. `npm run build` → exit 0, no errors. (No importMap change is expected — no new string-path components.)

- [ ] **Step 2: Manual verification**

`npm run dev`. Edit a Form: tick **Sunday school registration form** → the **Student first name** and **Student last name** fields appear in the builder immediately. Try deleting one and saving → save is rejected with the guardrail message. Untick the flag → fields remain (deletable). Publish the form, submit it on the public site, and confirm an **unplaced student** appears (dashboard "to place" / wizard Step 4 / Students tab) with the submitted name. (Requires the migration applied: `npx payload migrate`.)

- [ ] **Step 3: Commit (only if anything changed)**

If `npx payload generate:importmap` or other regen produced changes, commit them; otherwise skip.

---

## Self-Review

**Spec coverage:**
- Shared pure helper (`ensureStudentFields`, `hasRequiredRegistrationFields`, `REGISTRATION_FIELD_DEFS`) → Task 1. ✔
- Flag checkbox on Forms → Task 2. ✔
- Server guardrail (reject save if flag on and fields missing) → Task 2. ✔
- Instant client injection on toggle → Task 3. ✔
- Hook triggers on flag, maps snake_case required + optional → Task 4. ✔
- Migration (boolean column, user applies) → Task 2. ✔
- Tests for helpers + mapping → Tasks 1, 4. ✔
- Old marker + camelCase removed → Task 4. ✔

**Placeholder scan:** none — every step has complete code. The client effect is intentionally verified via build + manual (it's a thin wrapper over the tested pure helper), which the plan states explicitly.

**Type consistency:** `ensureStudentFields(schema, makeId)` / `hasRequiredRegistrationFields(schema)` / `REGISTRATION_FIELD_DEFS` defined in Task 1 and consumed with matching signatures in Tasks 2 (server) and 3 (client). `mapRegistrationFields(data, tenantId)` signature unchanged (only the keys it reads change), so its existing caller in the hook stays valid. Field `name` values (`student_first_name`, `student_last_name`, `student_age`, `guardian_*`, `allergies`) are identical between the injected fields (Task 1/3) and the mapping (Task 4).
