# School Registration Form Template + Typed Guardians Block

**Date:** 2026-06-22
**Status:** Approved (design)
**Branch (suggested):** `feat/school-registration-template`

## Problem

The form builder produces fields with auto-generated, free-form names
(`short_text_2`, `phone`, …). The student materializer
(`mapParticipantToStudent`) builds `student.guardians[]` by reading **hardcoded
canonical keys** — `guardian_name`, `guardian_phone`, `guardian_email`. Those
keys never match what the builder emits, so:

- `student.guardians[]` is **empty** for every form-registered child (guardian
  data lives only in `registrationDetails` JSON).
- The check-in kiosk's only lookup, `findFamily(phone)` in
  `src/lib/checkin/data.ts`, matches a parent against `student.guardians[].phone`
  with **no fallback**. Empty guardians ⇒ no match ⇒ **parents cannot check
  their children in via the kiosk.**

This is the generic-form-builder vs. purpose-built-form tension: any field a
structured system consumes needs an explicit contract. Student-name fields have
one (seeded canonical names); class has one (resolved by `class-select` **type**);
guardians never got one.

## Goal / success criteria

1. A school-registration form built from the template reliably populates
   `student.guardians[]` — including a normalized **phone** — for every child.
2. A parent who registered through such a form can find and check in their
   children at the kiosk by phone.
3. The admin Student record's Guardians panel shows the registered guardians.
4. Relabeling a guardian field in the builder (e.g. "Phone" → "Mobile") does NOT
   break any of the above.
5. Building a school-registration form is fast: one template pick → a working,
   editable form.

## Decisions (locked)

- **Approach:** typed (role-identified) blocks, delivered as a **one-time
  template scaffold**. After creation the form is a normal, fully editable form.
- **Guardian scope:** **shared per submission** — one Guardians section at form
  level; its guardians apply to every child in the registration.
- **Guardian block shape:** **repeatable**, min 1; the **primary (first)
  guardian's phone is required**; additional guardians optional. Any guardian
  with a phone can check in (kiosk matches any `guardians[].phone`).
- **Contract mechanism:** **role**, not name. The role is authoritative; the
  label is cosmetic and freely editable.
- **No backfill.** Forward-only. Existing form-registered students keep their
  empty `guardians[]` (out of scope; see below).
- **Template scope:** **form scaffold only.** Program binding + pricing stay in
  the existing setup wizard.
- **No new publish invariant for guardians.** Because the scaffold is editable
  and deletable, we do NOT make the Guardians block a publish requirement (that
  would contradict "one-time, editable scaffold"). Student-name/program/group
  invariants are unchanged.

## Architecture

### 1. Schema: role tagging (`src/lib/form-schema.ts`)
Add an optional `role` discriminator:
- On the **repeatable-group**: `role?: 'guardians'` marks the guardians block.
- On **leaf fields**: `role?: 'guardian_name' | 'guardian_phone' |
  'guardian_email' | 'guardian_relationship'`.

Roles are optional metadata — existing schemas remain valid (additive zod
change). The block stays a normal repeatable-group with normal leaf children, so
the existing builder and public-form rendering work with no special UI; `role`
just travels with the field.

### 2. Role resolvers (`src/lib/registration-fields.ts`)
Parallel to `classSelectFieldName`:
- `guardiansGroup(schema)` → the repeatable-group with `role === 'guardians'` (or
  null).
- Helpers to read a guardian item's value by child role.

### 3. Template scaffold (`src/lib/registration-template.ts`, new)
A pure function returning a `FormSchema` (+ the form's `schoolRegistration: true`,
`registration.participantModel: 'children'`) composed of:
- **Students** participant repeatable-group (seeded `student_first_name`,
  `student_last_name`; common optional fields e.g. grade, allergies).
- **Guardians** repeatable-group (`role: 'guardians'`) with role-tagged children:
  name (required), phone, email, relationship.
- Stable ids via an injected id factory (deterministic in tests).

Entry point: a **"School registration"** option in the form-create flow (forms
admin). Picking it seeds the new form with this schema. Exact UI insertion point
is an implementation detail for the plan; it must produce a normal editable form.

### 4. Materializer (`src/lib/school-enroll.ts` + call site)
`mapParticipantToStudent` becomes **role-based and multi-guardian**:
- Resolve the guardians group by role; for each guardian item, read name/phone/
  email/relationship by child role.
- Produce `guardians[]` with **every** guardian (not just one), `isPrimary` on
  the first, phones **normalized** with the same helper the kiosk uses.
- Call site in `src/hooks/createStudentFromRegistration.ts` passes the resolved
  guardian list (shared per submission) to each child.

### 5. Phone normalization (`src/lib/phone.ts`, new — extract)
Extract `normalizePhone` (currently private in `src/lib/checkin/data.ts`) into a
shared module; the kiosk and the materializer both import it so match-time and
store-time normalization can never drift. Kiosk behavior is otherwise unchanged.

### 6. Validation
Public **submit** validation (`validateFields`/`validateSubmission`), applied
only **when a guardians block is present**: the group has ≥1 item and the
**first** item's `guardian_phone` is present. (Per-item "first required, rest
optional" is a targeted rule on the role-tagged phone child; mechanism is a plan
detail.) This is distinct from the admin **publish** invariant — an admin who
deletes the scaffolded block simply gets no guardian mapping (accepted tradeoff
of an editable scaffold); nothing forces the block to stay.

## Data flow

```
Template pick → form scaffold (Students + Guardians[role] + custom)
   → admin edits/labels freely (roles preserved)
   → parent submits public form
   → form-submission row (answers keyed by field name; roles in form schema)
   → materializeStudentsFromSubmission:
        resolve guardians group by role → [{name, phone(normalized), email, relationship, isPrimary}]
        for each child → student.guardians[] = that shared list
   → kiosk findFamily(phone): normalizePhone(entered) == normalizePhone(guardians[].phone) ✓
```

## Components / files touched

- `src/lib/form-schema.ts` — add optional `role` to leaf + repeatable-group (zod).
- `src/lib/registration-fields.ts` — `guardiansGroup` + guardian role readers.
- `src/lib/registration-template.ts` — **new** pure schema builder.
- `src/lib/phone.ts` — **new** extracted `normalizePhone`.
- `src/lib/checkin/data.ts` — import shared `normalizePhone` (no behavior change).
- `src/lib/school-enroll.ts` — role-based, multi-guardian, normalized mapping.
- `src/hooks/createStudentFromRegistration.ts` — pass resolved guardians to mapper.
- Forms create flow (`src/admin/forms/…`) — "School registration" template option.
- Tests (below).

## Testing

- **Unit (TDD, pure):**
  - `registration-template`: produces a valid schema (passes `validateSchema`),
    contains the guardians group with role-tagged children + seeded student fields.
  - `registration-fields`: `guardiansGroup` resolves the group; ignores
    relabeled-but-role-tagged fields correctly.
  - `school-enroll`: role-based mapping yields multiple guardians with
    `isPrimary` on the first and normalized phones; tolerates missing optional
    fields; returns no guardians when the block is absent.
  - `phone`: normalization parity (same input → same output as kiosk expects).
  - `form-schema`: validation requires ≥1 guardian + primary phone.
- **Browser (verify):** scaffold a form from the template, submit as a parent,
  confirm the created student's `guardians[]` (with phone) in the DB, then enter
  that phone at the kiosk and confirm the child is found.

## Out of scope (explicit)

- **Backfill** of existing form-registered students' empty `guardians[]`
  (forward-only by decision; would be a separate spec, likely needs the form's
  roles + per-legacy-form mapping).
- **Program/pricing wiring** from the template (stays in the setup wizard).
- **Per-child guardians** and shared+override (chose shared per submission).
- **Protected/undeletable sections** (chose one-time editable scaffold).
- **Publish-time guardian invariant.**
