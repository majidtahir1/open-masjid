# School Registration Form Flag — Explicit Flag over Naming Convention

**Status:** Design approved, pending implementation plan
**Date:** 2026-06-17
**Replaces:** the slug/title marker convention in `createStudentFromRegistration`

## Goal

Today a Form becomes a Sunday-school registration form by a fragile convention: its slug/title must contain `sunday-school-registration` and its fields must be named `firstName`/`lastName`. That convention is also **broken** — form-builder field names must match `^[a-z][a-z0-9_]*$` (lowercase + underscores), so a field literally cannot be named `firstName`, and the hook's camelCase keys never match real submissions.

Replace it with an explicit **checkbox flag** on the Form. Turning the flag on instantly injects the two required student name fields into the builder, and the registration hook keys off the flag (not a name in the title), mapping snake_case field names.

## Non-goals

- Auto-adding guardian/age/allergies fields (admin adds those if wanted; the hook picks them up opportunistically if present).
- Removing the student fields when the flag is turned off (left in place; admin manages).
- A form-template gallery or one-click form provisioning.
- Backward compatibility with the old marker (it never worked for real builder forms).

## Architecture

### Shared pure helper — `src/lib/registration-fields.ts`
One source of truth for the required fields, used by both the client (inject) and server (guard), and unit-tested.

- `REGISTRATION_FIELDS`: the two field definitions —
  `{ type: 'short-text', name: 'student_first_name', label: 'Student first name', required: true }` and the `student_last_name` equivalent (ids assigned when injected).
- `ensureStudentFields(schema, makeId)`: returns the schema with both fields present — idempotent (matches by `name`), prepends any missing field to the first step, assigns a fresh id via the injected `makeId`. Pure (id generator passed in so it's deterministic in tests).
- `hasRequiredRegistrationFields(schema)`: true iff both names exist somewhere in the schema.

### Flag field — `src/collections/Forms.ts`
Add a sidebar checkbox:
```
{ name: 'schoolRegistration', type: 'checkbox', defaultValue: false,
  label: 'Sunday school registration form',
  admin: { position: 'sidebar', description: 'Submissions create an unplaced student you can place into a class.' } }
```
Requires a migration (one boolean column on `forms`).

### Instant injection (client) — `src/admin/forms/FormBuilderField.client.tsx`
The builder already reads sibling fields with `useField` (e.g. `slug`, `tenant`). Add `useField<boolean>({ path: 'schoolRegistration' })` and an effect:
- When the flag is `true` and `hasRequiredRegistrationFields(schema)` is false, call `ensureStudentFields(schema, randomId)` and `setValue(next)`. The fields appear in the live builder immediately — no save required.
- The effect is guarded (only acts when fields are missing) so it can't loop.
- Turning the flag off does nothing (fields stay; admin can delete them).

### Server guardrail — `src/collections/Forms.ts` beforeChange
In the existing schema-validation `beforeChange`, after `validateSchema`: if `data.schoolRegistration === true` and `!hasRequiredRegistrationFields(data.schema)`, throw `Error('A registration form must keep the Student first name and Student last name fields.')`. A guard, not an auto-add — prevents silently breaking the integration by deleting those fields via the API or by clearing them.

### Hook rewire — `src/hooks/createStudentFromRegistration.ts`
- Trigger: replace the `REGISTRATION_MARKER` slug/title check with `form?.schoolRegistration === true`.
- `mapRegistrationFields(data, tenantId)`: read **snake_case** keys —
  required `student_first_name`, `student_last_name`; optional `student_age` (→ `age`), `guardian_name`/`guardian_phone`/`guardian_email` (→ one `guardians[0]`), `allergies` (→ `allergiesNotes`). Returns null if either required name is missing.
- Unchanged: creates the student with `status: 'active'` and no enrollment (unplaced), via `overrideAccess`, logging on failure. Unplaced students keep surfacing on the dashboard "to place", wizard Step 4, class-detail roster, and Students tab.

## Data flow

```
Admin: toggle "Sunday school registration form" on a Form
  → builder injects student_first_name + student_last_name (instant)
  → save (guard: those two fields must remain)
Parent: submits the published form
  → FormSubmissions.afterChange (createStudentFromRegistration)
      form.schoolRegistration === true ?
        → map snake_case fields → create unplaced Student
Admin: places the student into a class (existing flows)
```

## Testing

- **`registration-fields.ts`** — `ensureStudentFields` adds both fields when absent; is idempotent (no duplicates) when present or partially present; preserves existing fields/order; `hasRequiredRegistrationFields` true/false cases. (Deterministic via an injected id generator.)
- **`mapRegistrationFields`** — maps snake_case required + optional fields; returns null without the required names; ignores unrelated keys.
- The client effect and the Forms beforeChange guard are thin wrappers over the tested pure helpers (verified by build + manual toggle).

## Migration

`npx payload migrate:create form_school_registration` → adds the `school_registration` boolean column to `forms`. Applied by the user with `npx payload migrate`.
