# Programs — Multi-Day & Multiple Concurrent Terms

**Status:** Design approved, pending implementation plan
**Date:** 2026-06-17
**Builds on:** the Sunday school module (attendance, wizard, management/analytics)

## Goal

Generalize the single-weekly-Sunday-school model into **Programs**: each masjid can run **multiple concurrent programs** (e.g. a Saturday program and a Sunday program, each with its own classes/rosters/teachers/attendance), and each program can meet on **multiple days** (e.g. a summer camp Mon–Fri). The module and the "Term" concept are relabeled to **Programs / Program**.

Two limitations are removed:
1. **One meeting day per term** → a program meets on a **set of days**.
2. **One active term shown everywhere** → **multiple concurrent programs**, chosen with a header picker.

## Vocabulary & non-goals

- **Program** = the renamed "Term". The internal collection slug stays `terms` and the `term` relationship on classes stays `term` — this is a **UI relabel only**, to avoid a fragile table/FK rename migration. (A future full rename is possible but out of scope.)
- Non-goals: a tenant-configurable module label; cross-program analytics/rollups; moving a class between programs; per-day class schedules (a class meets on all of its program's days).

## Build order (two phases)

- **Phase 1 — Multi-day.** `meetingDays` set + session generation/reconcile/timeline + migration. Ships the daily-camp capability on the existing single-program flow.
- **Phase 2 — Multiple programs + picker + rename.** Drop the single-active assumption, add the URL-based program picker + "New program" flow, thread the selected program through every view, and relabel the UI to "Programs".

Each phase is its own implementation plan.

---

## Phase 1 — Multi-day

### Schema (`src/collections/Terms.ts`)
Replace the single `meetingDay` select with **`meetingDays`** (`type: 'select'`, `hasMany: true`, the seven weekday options, `defaultValue: ['sunday']`, label "Meets on", required/min-one). Requires a migration:
- Add the `meetingDays` storage (Payload `hasMany` select → a `terms_meeting_days` table).
- **Backfill**: for every existing term, copy `meetingDay` → `meetingDays = [meetingDay]` (hand-edited data step in the migration).
- Drop the old `meetingDay` column.
The migration is generated with `npx payload migrate:create`, then **hand-edited to copy the data before the drop**, and applied by the user with `npx payload migrate`.

### Session generation (`src/hooks/generateClassSessions.ts`)
- Keep `weeklyDates(start, end, weekday, holidays?)` as the single-day building block.
- Add pure **`programDates(start, end, days: string[], holidays?)`** → the union of `weeklyDates` across each day, deduped, **sorted ascending**, with holidays excluded.
- `generateClassSessions` (class create) and `syncTermSessions` (term update) read `term.meetingDays` and use `programDates`. `reconcileSessions` is unchanged (still diffs desired vs existing).

### UI
- **`SessionTimeline`**: take `meetingDays: string[]` instead of `meetingDay`; compute beads from `programDates(start, end, meetingDays)` (no holiday exclusion in the editor — it greys days off). Day-off toggle unchanged.
- **`StepTerm`** (wizard): replace the single day `<select>` with a **multi-select of day chips** (toggle buttons) writing `meetingDays`. Live preview uses the union. Require ≥1 day.
- **Masthead / hub**: render the day set as a readable label (e.g. "Saturdays & Sundays", "Mon–Fri") via a small `formatDays(days)` helper; the session count uses `programDates`.

### Tests
- `programDates`: union across days, dedupe when days overlap a date, holiday exclusion, sorted order, empty when no days.
- `formatDays`: 1 day, 2 days, weekday-run formatting.

---

## Phase 2 — Multiple concurrent programs + picker + rename

### Program resolution (`src/lib/program-context.ts`, pure where possible)
- **`resolveProgramId(searchParamProgram, programs)`**: given the `?program=` value and the list of the tenant's programs (active first, newest first), return the chosen program id — the requested one if it exists, else the newest active, else null. `'new'` resolves to "create mode" (null selected, wizard in create).
- Server pages load the tenant's programs, call `resolveProgramId`, and scope their queries to that program id (instead of the current "newest active, limit 1").

### Program picker (`src/admin/school/ProgramPicker.tsx`, client)
- A header dropdown listing the tenant's programs (active first); selecting one navigates to the **current path** with `?program=<id>` (via `useRouter`/`usePathname`). Includes a **"+ New program"** item → navigates to the wizard with `?program=new`.
- Rendered alongside `SchoolTabs` on every management page.

### Threading
- **Dashboard, Classes list, Attendance, Take-Attendance**: scope to the resolved program (their class queries filter `term = <programId>`; take-attendance's class picker filters likewise).
- **Class detail**: already keyed by class id; its "back to classes" and roster "move to" stay within the class's program (the roster move list already filters by the class's term).
- **Students tab**: stays **tenant-wide** (a student may be enrolled across programs); each row shows their class/program. No program scoping.
- **Wizard**: operates on the resolved program; `?program=new` (or no programs yet) puts **StepTerm in create mode** — it creates a fresh program instead of editing the newest active one. After creation it continues the flow for that new program.

### "New program" / create mode
- `StepTerm` distinguishes create vs edit: when `?program=new` (or there is no program), the term loader does **not** prefill an existing program; saving **POSTs** a new program. When a program id is resolved, it **PATCHes** that program.

### Rename (UI strings only)
- Nav link "Sunday School" → **Programs**; tab header; masthead eyebrow/labels; wizard title ("Set up your school" → "Set up your program"); empty states; the Terms collection `labels`/admin `group`/descriptions → "Program(s)". The internal slugs (`terms`, `school-classes`, etc.) are unchanged.

### Tests
- `resolveProgramId`: requested-exists, fallback-to-newest-active, none, `'new'`.
- UI threading and rename verified by build + manual walkthrough (two concurrent programs, switching, creating a new one).

### Migration
None — no schema change in Phase 2 (multiple `active` programs are already allowed; the change is behavioral + labels).

---

## Risks & decisions

- **Relabel, not rename.** Keeping the `terms` slug avoids a destructive table/FK rename; the cost is a small naming mismatch between UI ("Program") and DB ("term"), documented here.
- **Multi-day migration copies data.** The generated migration must be hand-edited to backfill `meetingDays` from `meetingDay` before dropping the old column, or existing terms lose their meeting day.
- **Students are tenant-wide**, intentionally cross-program; only Dashboard/Classes/Attendance/Take-Attendance/Wizard are program-scoped.
- **Take-attendance & the public registration form** are program-agnostic except where they list classes; the class picker filters to the selected program.
