# Registration Program Targeting — "For program" on registration forms

**Status:** Design approved, pending implementation plan
**Date:** 2026-06-17
**Builds on:** the school-registration flag and the Programs (multi-term) model

## Goal

With multiple concurrent programs, a public registration form should declare **which program** it registers students for, so registrants route to the right program's placement queue. Add a "For program" selector to registration forms; stamp each created student with that program; and make placement (wizard + dashboard) strictly per-program.

## Non-goals

- Auto-enrolling a registrant into a class (admin still places by age/class).
- Making students owned by a program (students stay tenant-wide; `registeredProgram` is a routing hint, not ownership).
- Backfilling `registeredProgram` for pre-existing students (they remain placeable via the class Roster catch-all).

## Architecture

### Schema (one migration)
- **`forms.registrationProgram`** — relationship to `terms` (the program), nullable in the DB. Shown in the admin only when `schoolRegistration` is checked (`admin.condition`). Tenant-scoped relationship.
- **`students.registeredProgram`** — relationship to `terms`, nullable. Set by the registration hook (and on manual wizard add). Surfaced as a "registered for" hint.

Both are nullable relationship columns → a single migration (generated via `npx payload migrate:create`, applied by the user).

### Server guardrail (`src/collections/Forms.ts`)
Extend the existing registration beforeChange guardrail: when `data.schoolRegistration === true`, in addition to requiring the student-name fields, require `data.registrationProgram` to be set — else throw `Error('A registration form must have a program selected (For program).')`. This guarantees every registrant is routed.

### Hook (`src/hooks/createStudentFromRegistration.ts`)
When the form is a registration form, resolve the form's `registrationProgram` (id) and include it on the created student: `registeredProgram: <programId>`. `mapRegistrationFields` gains a `registeredProgram` param (or the hook adds it after mapping). Unchanged otherwise (student created `active`, unplaced).

### Placement filtering — strict per-program

- **Wizard → StepStudents "Place registered students"** (already program-scoped via `programId`): change the unplaced query to **students whose `registeredProgram` equals the current program** and who are not actively enrolled in this program's classes. The "Add a new student" panel tags the created student with `registeredProgram = programId` (it enrolls immediately, so it's placed, but stays consistent).
- **Dashboard "to place"** (`page.tsx` aggregation, program-scoped): the `unplaced` count becomes **students with `registeredProgram === term.id` not enrolled in this program's active classes** (instead of the current tenant-wide active-students-minus-enrolled). The "Place them" link is unchanged.
- **Class detail → Roster → "Enroll a student"**: UNCHANGED — keeps showing all unplaced students (tenant-wide), as the catch-all to place anyone.
- **Students tab**: each row shows a small "registered for *Program*" pill when `registeredProgram` is set (resolve the program name; the list already loads enrollments — also load programs for name lookup, or use the populated relationship at `depth=1`).

### Pure helper (testable)
`unplacedForProgram(students, enrollments, programId)` in `src/lib/school-setup.ts` (or `school-reports.ts`): given active students (each with `registeredProgram`), the program's active enrollments, and the program id → the students registered for that program and not in the placed set. Used by the dashboard aggregation; the wizard can use the same logic client-side or the helper.

## Data flow

```
Admin: Form → check "Sunday school registration" → pick "For program: Summer Camp" → save
  (guardrail: program required)
Parent: submits the public form
  → createStudentFromRegistration: create Student { ..., registeredProgram: SummerCamp }
Admin (Summer Camp selected): wizard Students step shows that registrant → place into a Summer Camp class
Dashboard (Summer Camp): "N to place" counts only Summer Camp registrants
```

## Testing

- **Guardrail** — saving a `schoolRegistration` form without `registrationProgram` throws; with it, passes (alongside the existing student-fields requirement).
- **Hook** — `mapRegistrationFields`/the hook includes `registeredProgram` from the form; absent when not a registration form.
- **`unplacedForProgram`** — returns only students registered for the program and not enrolled; ignores other programs' registrants and placed students; empty cases.
- Wizard/students-tab UI verified by build + manual.

## Migration

`npx payload migrate:create registration_program_targeting` → adds the two nullable relationship columns (`forms.registration_program_id`, `students.registered_program_id` + indexes). Applied by the user with `npx payload migrate`.
