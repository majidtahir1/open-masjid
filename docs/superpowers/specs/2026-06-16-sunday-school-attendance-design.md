# Sunday School Attendance — Term-Based Class Attendance Tracking

**Status:** Design approved, pending implementation plan
**Date:** 2026-06-16

## Goal

Give each masjid a tenant-scoped Sunday school module where admins set up Terms and Classes, students enroll (via a public registration form or admin entry), and teachers mark a weekly per-class roster. The **primary job is producing attendance records** — who showed up to which class each session — usable for reports to parents and admins.

The data model is shaped so that the flagged future goals (safety/pickup, enrollment-linked tuition) can layer on later without rework. `Enrollments` and `ClassSessions` exist as first-class records precisely because those are the seams those features will attach to.

## Non-goals (v1)

- **Parent self check-in via kiosk/QR.** Attendance is marked by teachers and school staff, not parents. (Model does not preclude adding it later.)
- **Tuition / billing.** Students carry an optional `member` link for the future, but no payment flow in v1.
- **Safety / pickup management** (ratios, authorized-pickup check-out).
- **Custom dashboards or charts.** v1 reporting is Payload-native list/filter + CSV export.
- **Capacity enforcement.** `capacity` is informational only.
- **Per-section class choice at registration.** Parents give the child's age; admin places the child in a class.

## Roles

Two new tenant-scoped roles are added to the Users `role` field (alongside `platformOwner`, `admin`, `staff`, `kioskManager`):

- **`school_admin`** — runs the Sunday school. Full CRUD on all six school collections **across every class in their tenant**. Module-scoped: does **not** grant access to the rest of the tenant (donations, members, prayer times). This is the front-desk / coordinator role that can mark attendance anywhere.
- **`teacher`** — a low-privilege user scoped to **only their assigned classes** (classes where `SchoolClasses.teachers` contains them). Marks attendance and edits sessions/students for those classes; cannot create structural records.

Existing roles: `platformOwner` = all; `admin` = own-tenant CRUD on everything including these collections; `staff` = read-only; `kioskManager` = no access.

## Architecture

Six new tenant-scoped Payload collections. Each carries a `tenant` relationship and uses the existing `setTenantFromUser` hook and `tenantScoped*` access helpers, matching collections like Kiosks/Members.

```
src/collections/
  Terms.ts              ← academic period (e.g. "Fall 2026")
  SchoolClasses.ts      ← a class offered in a term
  Students.ts           ← a child; independent of any paying Member
  Enrollments.ts        ← joins a student to a class for a term (the roster)
  ClassSessions.ts      ← one weekly meeting of a class
  AttendanceRecords.ts  ← one student's status for one session
```

Relationship chain:

```
Term → SchoolClass → ClassSession → AttendanceRecord
                         (Student reaches in via Enrollment = roster,
                          and via AttendanceRecord = the marks)
```

### Collections

**`Terms`**
- `name` (text, e.g. "Fall 2026"), `startDate` (date), `endDate` (date)
- `meetingDay` (select, weekday; default Sunday)
- `status` (select: `active` | `archived`)
- `tenant`

**`SchoolClasses`**
- `name` (text, "Grade 3 Quran")
- `term` (relationship → terms)
- `teachers` (relationship → users, hasMany)
- `gradeLevel` (text, optional)
- `room` (text, optional)
- `capacity` (number, optional — informational only)
- `tenant`

**`Students`**
- `firstName`, `lastName` (text)
- `age` (number — captured from the registration form)
- `gradeLevel` (text — assigned by admin during placement)
- `guardians` (array: `name`, `relationship`, `phone`, `email`, `isPrimary`)
- `allergiesNotes` (textarea)
- `emergencyContact` (text/group)
- `member` (relationship → members, optional — reserved for future tuition)
- `status` (select: `active` | `inactive`)
- `tenant`

**`Enrollments`** — the roster join.
- `student` (relationship), `class` (relationship → school-classes)
- `status` (select: `active` | `withdrawn`)
- `enrolledAt` (date)
- `tenant`
- Unique on (tenant, student, class).
- A student with no `active` enrollment is **"unplaced"** (the admin placement queue).

**`ClassSessions`** — one weekly meeting.
- `class` (relationship → school-classes)
- `date` (date)
- `status` (select: `scheduled` | `held` | `cancelled`)
- `notes` (textarea, optional)
- `tenant`
- Auto-generated for each weekly `meetingDay` between the term's start/end when a class is created; admin can add or cancel individual sessions (holidays).

**`AttendanceRecords`** — one student per session.
- `session` (relationship → class-sessions)
- `student` (relationship)
- `status` (select: `present` | `absent` | `late` | `excused`)
- `markedBy` (relationship → users), `markedAt` (date)
- `note` (text, optional)
- `tenant`
- Unique on (tenant, session, student) — enforces one record per student per session (upsert).

### Access matrix

| Collection | platformOwner | admin | staff | school_admin | teacher |
|---|---|---|---|---|---|
| Terms | all | tenant CRUD | read | tenant CRUD | read |
| SchoolClasses | all | tenant CRUD | read | tenant CRUD | read own classes |
| Students | all | tenant CRUD | read | tenant CRUD | read **+ update** enrolled students |
| Enrollments | all | tenant CRUD | read | tenant CRUD | read for own classes |
| ClassSessions | all | tenant CRUD | read | tenant CRUD | read/update own classes' sessions |
| AttendanceRecords | all | tenant CRUD | read | tenant CRUD | create/read/update for own classes |

Teacher scoping is enforced by access functions returning a Payload `where` query (e.g. AttendanceRecords filtered to sessions whose class lists the current user in `teachers`), mirroring how `Members` returns `{ tenant: { equals } }` today. Teachers can never see or touch students outside their roster (students hold PII: guardian contacts, allergies).

## Flows

### Take Attendance (the core daily action)

A dedicated custom admin page at **`/admin/take-attendance`** (Payload supports custom admin views; this app already uses custom admin components like `KioskPushButton` and list banners). It reads/writes through Payload's API under the logged-in user, so tenant + teacher scoping is enforced automatically.

1. Teacher or school_admin opens the page.
2. Picks a **class** (teachers see only theirs; school_admin sees all) → view auto-selects **today's `ClassSession`** (or nearest scheduled date; date is changeable).
3. Roster renders from `active` `Enrollments` for that class — each student a row with **Present / Absent / Late / Excused** toggles, defaulting to **unset (explicit marking)**.
4. Tapping a toggle upserts an `AttendanceRecord` (session + student), stamping `markedBy` and `markedAt`.
5. Header shows live counts (e.g. "12 present / 3 absent / 5 unmarked") plus a "mark all present" shortcut. Unmarked students stay surfaced so none are forgotten.

### Registration

**Admin / school_admin manual entry:** create a `Student`, then create `Enrollment(s)` into classes. Standard Payload admin.

**Parent registration form:** reuses the existing **Forms / FormSubmissions** infrastructure (honeypot + validation already in place). A "Sunday School Registration" form collects student name, **age**, guardian contacts, and allergies. On submit, a hook creates an **unplaced `Student`** (status `active`, no enrollment). The school_admin reviews the **unplaced-students queue** (active students with no active enrollment), sets `gradeLevel`, and creates the `Enrollment` into the right class. No student is silently auto-added to a roster.

## Reporting (v1)

Built on Payload-native list/filter + export; no custom dashboards yet.

- **Per-session view** — open a `ClassSession`, see its attendance records with present/absent counts (also shown live on the Take-Attendance screen).
- **Per-student history** — on a `Student`, their attendance across sessions over the term (spot a child who's regularly missing).
- **Per-class/term rollup** — a filtered `AttendanceRecords` list (by class + term + date range), CSV-exportable via Payload's built-in export for parent emails or board reports.

## Testing

Follows the repo's `tests/collections/*.access.test.ts` patterns.

- **Access tests** per collection — `teacher` sees only their classes/students; `school_admin` is tenant-wide; `staff` read-only; cross-tenant isolation holds.
- **Hook tests** — session auto-generation produces correct weekly dates within term bounds; registration-form submission creates an unplaced student; attendance upsert enforces one record per (session, student).
- **Take-Attendance flow** — integration test that marking writes records under the acting user's access scope.

## Open questions / fast-follows

- Custom attendance dashboards and charts (deferred until real data exists).
- Tuition/billing via the `Student.member` link.
- Safety/pickup management.
- Parent kiosk/QR self check-in.
