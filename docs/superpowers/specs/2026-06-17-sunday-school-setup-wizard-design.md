# Sunday School Setup Wizard & Hub — Guided Module Setup

**Status:** Design approved, pending implementation plan
**Date:** 2026-06-17
**Builds on:** [Sunday school attendance module](2026-06-16-sunday-school-attendance-design.md)

## Goal

The Sunday school module currently exposes six raw collection links (Terms, Classes, Students, Enrollments, Sessions, Attendance). Non-technical admins don't understand how they relate — especially that **Sessions are auto-generated from a Term's dates**. Replace those links with a single **"Sunday School" hub** plus a **step-by-step setup wizard** that walks an admin through Term → Classes → Teachers → Students, making the relationships explicit.

## Non-goals (v1)

- **No new persistence.** The wizard reads/writes the existing six collections via REST; "progress" is derived from data state (resumable without a wizard-state table).
- **No bulk import** of students (CSV etc.).
- **No drag-and-drop** placement — a class dropdown per student is sufficient.
- **No custom dashboards/charts** beyond the hub's status tiles.
- **Teachers step is optional** — classes can be created teacherless and assigned later.
- The wizard does not replace direct collection access — the six collections stay reachable by URL for debugging; they are only removed from the nav.

## Architecture

Two custom admin routes (same proven pattern as `take-attendance` and `membership/overview`: server component, role-gated, wrapped in `DefaultTemplate`, importMap-registered, client components doing REST CRUD under the acting user).

```
src/app/(payload)/admin/sunday-school/
  page.tsx              ← hub (server: role gate + summary load) → HubClient
  setup/page.tsx        ← wizard shell (server: role gate) → SetupWizard (client stepper)
src/admin/school/
  HubClient.tsx         ← hub dashboard view (status tiles, explainer, actions)
  SetupWizard.tsx       ← client stepper; owns step state + ?step= deep-link
  steps/StepTerm.tsx
  steps/StepClasses.tsx
  steps/StepTeachers.tsx
  steps/StepStudents.tsx
  SundaySchoolNav.tsx   ← MODIFY: repoint to /admin/sunday-school
src/lib/
  school-setup.ts       ← pure helpers: firstIncompleteStep(), buildHubSummary()
src/endpoints/
  inviteUser.ts         ← MODIFY: allow inviting 'teacher' / 'school_admin'
src/collections/        ← MODIFY 6 files: admin.hidden true (remove from nav)
```

### Nav & collection visibility

- `SundaySchoolNav` repoints from `/admin/take-attendance` to `/admin/sunday-school`. Role gate unchanged (`platformOwner`, `admin`, `school_admin`, `teacher`). After regenerating, confirm the importMap entry persists.
- The six collections set `admin.hidden: true` (replacing the current `hideForKioskManager` function value). This removes them from the nav for everyone while keeping `/admin/collections/<slug>` routes reachable. (Access control is unchanged — `hidden` is nav-only.)

### Resumability (no new state)

On load the wizard fetches the active term and derived counts, then `firstIncompleteStep()` picks where to land:

- no active term → step 1 (Term)
- term but 0 classes → step 2 (Classes)
- classes exist → step 3 (Teachers) is **skippable**, so it never blocks; default landing for a partially-set-up term is step 4 unless the user explicitly navigates back
- fully set up → Finish summary

Each step persists immediately (creating real records), so closing and returning loses nothing.

## The Hub (`/admin/sunday-school`)

Server component loads a summary via `getPayload` + `createLocalReq` (mirrors `membership/overview`), passes it to `HubClient`.

**Content:**
- **Active term card** — name, dates, meeting day, and "**N weekly sessions** auto-created (range)". No active term → empty state with **Start setup**.
- **Relationship explainer** (always visible): *"A Term holds Classes. Each Class meets weekly — Sessions are created automatically from the term's dates. Students enroll into Classes."*
- **Status tiles** — # classes, # classes without a teacher, # students placed, # students unplaced.
- **Actions** — "Continue setup" (opens wizard at `firstIncompleteStep`), "Take attendance", and contextual deep links (e.g. unplaced count → wizard Students step).

**Role behavior:**
- `platformOwner / admin / school_admin` — full hub with setup actions.
- `teacher` — trimmed hub: assigned classes + "Take attendance"; **no setup button**.
- `staff / kioskManager` — redirected out.

## The Wizard (`/admin/sunday-school/setup`)

Client stepper; deep-linkable via `?step=`; persistent step bar with checkmarks. Route gated to `platformOwner / admin / school_admin` (teacher → redirect to hub).

**Step 1 — Term.** Create or select/edit the active term (`name`, `startDate`, `endDate`, `meetingDay`). Live preview after save: "This term has **N <weekday>s** (start → end). Each class you add will get these N sessions automatically." Cannot advance without an active term.

**Step 2 — Classes.** Add classes (`name`, `gradeLevel`, `room`, `capacity`) to the term; list existing with their auto-generated session count. Creating a class fires the existing `generateClassSessions` hook. Needs ≥1 class to advance.

**Step 3 — Teachers (skippable).** Per class: pick an existing `teacher` User, or invite a new one (`firstName`, `lastName`, `email`) via the extended invite endpoint (creates a `teacher`, sends invite). Shows "No teacher assigned" where empty. Prominent **Skip**.

**Step 4 — Students.** Two equal panels:
- **Place registered** — unplaced students each with a class dropdown → assigning creates an `Enrollment` (status `active`).
- **Add new** — compact form (`firstName`, `lastName`, `age`, one guardian) → creates a `Student` and an `Enrollment` into a chosen class.

**Finish.** Summary (term, N classes, teacher coverage, students placed) + buttons to hub and take-attendance.

## Invite endpoint extension (`src/endpoints/inviteUser.ts`)

- Add `'teacher'` and `'school_admin'` to the allowed `role` union.
- Rules: `platformOwner` may invite any role/tenant. `admin` and `school_admin` may invite `teacher` (and `staff`) **into their own tenant only**; they may **not** invite `admin`, `school_admin`, or `platformOwner`. Existing admin→admin/staff behavior preserved except the elevation guard now also blocks `school_admin`.
- This is the only piece with real auth logic → dedicated tests.

## Access & gating summary

| Surface | platformOwner | admin | school_admin | teacher | staff/kiosk |
|---|---|---|---|---|---|
| Hub | full | full | full | trimmed (no setup) | redirect |
| Wizard | yes | yes | yes | redirect → hub | redirect |
| Collection nav links | hidden (URL-reachable) | hidden | hidden | hidden | hidden |

Route gates are UX; the collections' existing access functions remain the security boundary for all writes.

## Testing

- **`firstIncompleteStep(summary)`** — pure; unit-tested across all data states (no term, term-no-classes, classes, complete).
- **`buildHubSummary(docs)`** — pure; turns raw term/class/enrollment/student docs into the hub summary (counts: classes, teacherless classes, placed, unplaced). Unit-tested.
- **Invite extension** — `admin`/`school_admin` can invite `teacher` in-tenant; cannot invite `admin`/`school_admin`/`platformOwner`; cross-tenant rejected; `platformOwner` unrestricted.
- **Route role-gating** — assert the allowed-role sets for hub vs wizard helpers.
- **Step UIs** — manual verification (seed a term, walk the flow end-to-end), consistent with how `take-attendance` was verified.

## Open questions / fast-follows

- Bulk CSV student import.
- Drag-and-drop student placement.
- Multi-term management UI (archiving last term, cloning classes into a new term).
