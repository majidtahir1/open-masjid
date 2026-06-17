# Sunday School Management & Analytics — Branded Admin Surface

**Status:** Design approved, pending implementation plan
**Date:** 2026-06-17
**Builds on:** [Attendance module](2026-06-16-sunday-school-attendance-design.md) · [Setup wizard & hub](2026-06-17-sunday-school-setup-wizard-design.md)

## Goal

The setup wizard is excellent for *creating* a term, but there's no surface for *operating* the school: seeing which students are in which class, browsing attendance by session or by student, knowing what's live this term, and making day-to-day edits. Build a fully branded, custom management area — tabbed sections with a beautiful analytics **Dashboard**, plus full CRUD across Classes, Students, Sessions, and Attendance — consistent with the `ss-*` design language already established.

The six raw Payload collections stay hidden from the nav; everything is reached through this branded area.

## Delivery in two phases

Each phase ships working value on its own.

- **Phase 1 — shell + Dashboard + Classes.** Tab navigation, the analytics dashboard (KPIs + charts), and the Classes area (list of live classes → class detail with roster, teacher, and session management). Adds a `status` field to classes for archiving. Answers "what's live this term" and "which students are in which class."
- **Phase 2 — Students + Attendance.** Students list/detail (edit, guardians, enrollments, attendance history) and the Attendance reporting views (by session, by student) with CSV export.

This spec covers the whole vision; the first implementation plan covers Phase 1.

## Information architecture

A tabbed area under `/admin/sunday-school`. A persistent tab bar — **Dashboard · Classes · Students · Attendance · Setup** — renders on every page, styled in the `ss-*` language.

```
/admin/sunday-school                 Dashboard  (analytics)
/admin/sunday-school/classes         Classes list (live in active term) + create
/admin/sunday-school/classes/[id]    Class detail: edit · roster · teacher · sessions
/admin/sunday-school/students        Students list + search + create            [Phase 2]
/admin/sunday-school/students/[id]   Student detail: edit · enrollments · history [Phase 2]
/admin/sunday-school/attendance      Attendance: by session / by student + export [Phase 2]
/admin/sunday-school/setup           Existing wizard
```

**Access:** Dashboard, Classes, Students, Attendance tabs are for `platformOwner` / `admin` / `school_admin`. A `teacher` instead gets a trimmed Dashboard (their assigned classes + Take Attendance, no charts/CRUD) and is redirected away from the management tabs. The collections' own access functions remain the security boundary for every REST write.

## Component & data architecture

```
src/admin/school/
  SchoolTabs.tsx            ← persistent tab bar (client; highlights active route)
  charts/
    Donut.tsx               ← hand-rolled SVG donut (status breakdown)
    Bars.tsx                ← horizontal bar chart (rate/enrollment by class)
    AreaTrend.tsx           ← area/line sparkline (attendance trend over sessions)
  dashboard/
    DashboardClient.tsx     ← KPIs + charts + needs-attention (admin)
    TeacherDashboard.tsx    ← trimmed teacher view
  classes/
    ClassesClient.tsx       ← list + create
    ClassDetailClient.tsx   ← edit + roster + teacher + sessions panels
src/app/(payload)/admin/sunday-school/
  page.tsx                  ← Dashboard route (server: gate + aggregate → DashboardClient/TeacherDashboard)
  classes/page.tsx          ← Classes list route
  classes/[id]/page.tsx     ← Class detail route
src/lib/
  school-reports.ts         ← PURE aggregation/report functions (unit-tested)
```

- **Server components** fetch tenant-scoped data via `getPayload` + `createLocalReq` and feed **pure functions** in `school-reports.ts` that produce view-models. No data logic lives in React.
- **Client components** handle interactivity (forms, toggles, drag-free roster moves) via Payload REST under the user's session, using the shared `api()` + `toId()` helpers. No `overrideAccess` in client paths.
- **Charts** are presentational SVG components taking plain data props (no charting dependency added).

## Schema change (Phase 1)

`SchoolClasses` gains a `status` select (`active` | `archived`, default `active`), mirroring Students/Terms. "Live classes" = `status: active` in the active term. Archiving replaces deletion for classes that have sessions/attendance. **Requires a migration** (`npx payload migrate`).

## The Dashboard (analytics)

Server-aggregated, rendered by `DashboardClient`.

- **Term masthead** with the session rhythm (reused `SessionTimeline`).
- **KPI cards**: total students · active classes · **average attendance rate** · sessions held / upcoming.
- **Charts** (all four):
  1. **Attendance trend** — area/line of overall present-rate across each session date in the term.
  2. **Attendance rate by class** — horizontal bars per class.
  3. **Status breakdown** — donut of present / absent / late / excused, term-to-date.
  4. **Enrollment by class** — horizontal bars of student count per class.
- **Needs attention** strip: classes without a teacher, unplaced students, today's session — each a deep link.

Empty/early states: when there's no attendance yet, charts show a friendly "no data yet" state rather than empty axes.

## Classes area (Phase 1)

**List** (`/classes`): cards/rows of **live classes in the active term** — name, grade, teacher, enrolled count, session count, attendance rate. A "New class" action. A toggle to show archived.

**Detail** (`/classes/[id]`): tabsless panels on one page:
- **Edit** — name, grade, room, capacity, status (archive/restore), delete (only when no history; otherwise the button archives and explains why).
- **Roster** — enrolled students with actions: enroll an existing student, **move** to another class, **withdraw** (sets enrollment `withdrawn`). Add-new-student inline.
- **Teacher** — assign existing `teacher` or invite (reuses the extended invite endpoint).
- **Sessions** — the class's sessions with date + status + attendance count; actions: **cancel / reactivate**, edit date/notes, **add an ad-hoc session**; each links to its attendance grid (Take Attendance).

## Students & Attendance areas (Phase 2)

- **Students**: searchable list with each student's class(es); detail page edits fields + guardians, manages enrollments (move/withdraw), and shows **attendance history** (present/absent over the term with a rate).
- **Attendance**: **by session** (pick class → session → read/edit grid) and **by student** (history); **CSV export** of a class/term attendance matrix for board reports and parent emails.

## Reporting functions (pure, tested)

In `school-reports.ts`, each takes plain docs and returns a view-model:
- `attendanceTrend(sessions, records)` → `[{ date, presentRate, total }]`
- `rateByClass(classes, enrollments, records, sessions)` → `[{ classId, name, rate }]`
- `statusBreakdown(records)` → `{ present, absent, late, excused }`
- `enrollmentByClass(classes, enrollments)` → `[{ classId, name, count }]`
- `dashboardKpis(...)` → `{ students, activeClasses, avgAttendanceRate, sessionsHeld, sessionsUpcoming }`
- `canHardDelete(history)` → boolean (no sessions/attendance/enrollments)

"Attendance rate" = present (+ optionally late counted as present? **No** — rate = `present / marked`, late and excused tracked separately) across held sessions.

## Testing

- **`school-reports.ts`** — unit tests for every function across realistic and empty inputs (trend ordering, rate math, breakdown counts, KPI edge cases, `canHardDelete`).
- **Access/gating** — assert management routes allow only the three admin roles; teacher redirect.
- **CRUD** — exercised via REST under access control (manual verification for the UI flows, consistent with how the wizard/take-attendance were verified).
- Charts are presentational; verified visually.

## Non-goals (v1)

- Cross-term historical analytics / year-over-year.
- Per-parent logins or parent-facing reports.
- Configurable/custom report builder.
- Bulk CSV import of students (still a fast-follow).
- Counting `late` as present in the headline rate.

## Open questions / fast-follows

- Teacher read access to the full management views (currently trimmed to their classes + attendance).
- Printable/PDF attendance sheets.
- Bulk student import.
