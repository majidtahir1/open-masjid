# Sunday School Management — Phase 1 (Shell + Dashboard + Classes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the branded tabbed management area — a persistent tab bar, an analytics Dashboard (KPIs + hand-rolled SVG charts), and a full Classes CRUD area (list of live classes → class detail with roster, teacher, and session management) — replacing the bare hub.

**Architecture:** Custom admin routes under `/admin/sunday-school` (server components gate + aggregate via `getPayload`; client components do CRUD via Payload REST + `toId`). Pure, unit-tested report functions in `src/lib/school-reports.ts` feed presentational SVG chart components. Adds a `status` field to `school-classes` for archiving (migration).

**Tech Stack:** Payload CMS 3.84, Next.js App Router, React client components, hand-rolled SVG charts (no new dependency), TypeScript, Vitest.

---

## Context the implementer needs

- **Route pattern:** copy `src/app/(payload)/admin/sunday-school/page.tsx` exactly for `DefaultTemplate` usage (it passes `i18n`, `params={{}}`, `payload`, `permissions`, `req`, `searchParams={{}}`, `user`, `visibleEntities`; computes `visibleEntities` via `isEntityHidden`; uses `getPayload({ config, importMap })`). Nested routes import `importMap` from the right relative depth (`../importMap`, `../../importMap`, `../../../importMap`).
- **Client REST:** use `api()` and `toId()` from `src/admin/school/api.ts`. `toId` is REQUIRED on any relationship id taken from a `<select>`/DOM value (Postgres integer ids reject numeric strings).
- **Design system:** styles live in `src/admin/school/sunday-school.css` (already imported by client components). Tokens: `--ss-navy-700`, `--ss-teal-500/600`, `--ss-gold-300/500/700`, `--ss-cream`, `--ss-serif`; surfaces on `--theme-elevation-*`. Reuse `ss-card`, `ss-btn`, `ss-stat`, `ss-row`, `ss-input`, `ss-select`, `ss-pill`, `ss-eyebrow`, `ss-display`.
- **Schema changes need a migration:** auto-push is OFF. After adding the class `status` field run `npx payload migrate:create` then `npx payload migrate`. A clean dev boot is NOT proof the column exists.
- **Lucide** icons are available (`lucide-react`).

---

## File Structure

```
src/collections/SchoolClasses.ts          ← MODIFY: add status select
src/lib/school-reports.ts                  ← CREATE: pure report/aggregation fns
src/admin/school/charts/Donut.tsx          ← CREATE: SVG donut
src/admin/school/charts/Bars.tsx           ← CREATE: SVG horizontal bars
src/admin/school/charts/AreaTrend.tsx      ← CREATE: SVG area/line trend
src/admin/school/SchoolTabs.tsx            ← CREATE: persistent tab bar
src/admin/school/dashboard/DashboardClient.tsx   ← CREATE: KPIs + charts + needs-attention
src/admin/school/dashboard/TeacherDashboard.tsx  ← CREATE: trimmed teacher view
src/admin/school/classes/ClassesClient.tsx       ← CREATE: list + create
src/admin/school/classes/ClassDetailClient.tsx   ← CREATE: edit + roster + teacher + sessions
src/app/(payload)/admin/sunday-school/page.tsx          ← MODIFY: Dashboard route
src/app/(payload)/admin/sunday-school/classes/page.tsx  ← CREATE: classes list route
src/app/(payload)/admin/sunday-school/classes/[id]/page.tsx ← CREATE: class detail route
src/admin/school/sunday-school.css         ← MODIFY: tabs, dashboard, chart, class-detail styles
tests/lib/school-reports.test.ts           ← CREATE
```

---

## Task 1: Add `status` to classes + migration

**Files:**
- Modify: `src/collections/SchoolClasses.ts`
- Migration: generated

- [ ] **Step 1: Add the field**

In `src/collections/SchoolClasses.ts`, append to the `fields` array (after `capacity`):

```ts
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { description: 'Archived classes are hidden from the live list but keep their history.' },
    },
```

- [ ] **Step 2: Typecheck + generate types**

Run: `npx tsc --noEmit` (clean), then `npm run generate:types`.
Expected: `SchoolClass.status` appears in `src/payload-types.ts`.

- [ ] **Step 3: Create + apply migration**

Run: `npx payload migrate:create class_status`
Then inspect the generated file under `src/migrations/` — it should only `ALTER TABLE "school_classes"` to add the `status` column (+ enum). Then run `npx payload migrate`.
Expected: column added; if migrate needs a running DB and it's unavailable, report BLOCKED on the apply step only and still commit the field + migration file.

- [ ] **Step 4: Run suite**

Run: `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/collections/SchoolClasses.ts src/payload-types.ts src/migrations/
git commit -m "feat(school): add archivable status to classes"
```

---

## Task 2: Pure report functions

**Files:**
- Create: `src/lib/school-reports.ts`
- Test: `tests/lib/school-reports.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/school-reports.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  attendanceTrend, rateByClass, statusBreakdown, enrollmentByClass, dashboardKpis, canHardDelete,
} from '@/lib/school-reports'

const sessions = [
  { id: 1, class: 10, date: '2026-09-06' },
  { id: 2, class: 10, date: '2026-09-13' },
  { id: 3, class: 11, date: '2026-09-06' },
]
const records = [
  { session: 1, status: 'present' }, { session: 1, status: 'absent' }, // class10 s1: 1/2
  { session: 2, status: 'present' }, { session: 2, status: 'present' }, { session: 2, status: 'late' }, // class10 s2: 2/3 present
  { session: 3, status: 'present' }, // class11 s3: 1/1
]
const classes = [{ id: 10, name: 'Grade 3' }, { id: 11, name: 'Grade 4' }]
const enrollments = [
  { class: 10, status: 'active' }, { class: 10, status: 'active' }, { class: 10, status: 'withdrawn' },
  { class: 11, status: 'active' },
]

describe('attendanceTrend', () => {
  it('present rate per held session, ordered by date', () => {
    const t = attendanceTrend(sessions, records)
    // two distinct dates: 2026-09-06 (sessions 1 & 3 → present 2 / marked 3) and 2026-09-13 (session 2 → 2/3)
    expect(t).toEqual([
      { date: '2026-09-06', present: 2, marked: 3, presentRate: 2 / 3 },
      { date: '2026-09-13', present: 2, marked: 3, presentRate: 2 / 3 },
    ])
  })
  it('ignores sessions with no records', () => {
    expect(attendanceTrend([{ id: 9, class: 10, date: '2026-10-01' }], [])).toEqual([])
  })
})

describe('rateByClass', () => {
  it('present / marked across each class', () => {
    const r = rateByClass(classes, sessions, records)
    expect(r).toEqual([
      { classId: 10, name: 'Grade 3', rate: 3 / 5, marked: 5 },
      { classId: 11, name: 'Grade 4', rate: 1, marked: 1 },
    ])
  })
  it('rate 0 and marked 0 for a class with no records', () => {
    expect(rateByClass([{ id: 99, name: 'Empty' }], [], [])).toEqual([{ classId: 99, name: 'Empty', rate: 0, marked: 0 }])
  })
})

describe('statusBreakdown', () => {
  it('counts each status', () => {
    expect(statusBreakdown(records)).toEqual({ present: 4, absent: 1, late: 1, excused: 0 })
  })
})

describe('enrollmentByClass', () => {
  it('counts active enrollments per class', () => {
    expect(enrollmentByClass(classes, enrollments)).toEqual([
      { classId: 10, name: 'Grade 3', count: 2 },
      { classId: 11, name: 'Grade 4', count: 1 },
    ])
  })
})

describe('dashboardKpis', () => {
  it('aggregates headline numbers', () => {
    const k = dashboardKpis({ students: [{ id: 1 }, { id: 2 }], classes, sessions, records, today: '2026-09-10' })
    expect(k.students).toBe(2)
    expect(k.activeClasses).toBe(2)
    expect(k.avgAttendanceRate).toBeCloseTo(4 / 6) // 4 present of 6 marked
    expect(k.sessionsHeld).toBe(3) // all three sessions have records
    expect(k.sessionsUpcoming).toBe(0) // no scheduled-future sessions passed (all held)
  })
})

describe('canHardDelete', () => {
  it('true only when no history', () => {
    expect(canHardDelete({ sessionCount: 0, attendanceCount: 0, enrollmentCount: 0 })).toBe(true)
    expect(canHardDelete({ sessionCount: 5, attendanceCount: 0, enrollmentCount: 0 })).toBe(false)
    expect(canHardDelete({ sessionCount: 0, attendanceCount: 0, enrollmentCount: 1 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/lib/school-reports.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/lib/school-reports.ts`:

```ts
const idOf = (v: unknown): string | number =>
  typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string | number }).id : (v as string | number)
const day = (d: unknown) => String(d ?? '').slice(0, 10)

export type Status = 'present' | 'absent' | 'late' | 'excused'
export interface SessionDoc { id: string | number; class: unknown; date: string }
export interface RecordDoc { session: unknown; status: Status }
export interface ClassDoc { id: string | number; name: string }
export interface EnrollmentDoc { class: unknown; status?: string }

export interface TrendPoint { date: string; present: number; marked: number; presentRate: number }

/** Present-rate per held session date (sessions with ≥1 record), ascending. */
export function attendanceTrend(sessions: SessionDoc[], records: RecordDoc[]): TrendPoint[] {
  const sessionDate = new Map(sessions.map((s) => [String(s.id), day(s.date)]))
  const byDate = new Map<string, { present: number; marked: number }>()
  for (const r of records) {
    const date = sessionDate.get(String(idOf(r.session)))
    if (!date) continue
    const cur = byDate.get(date) ?? { present: 0, marked: 0 }
    cur.marked += 1
    if (r.status === 'present') cur.present += 1
    byDate.set(date, cur)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({ date, present: v.present, marked: v.marked, presentRate: v.marked ? v.present / v.marked : 0 }))
}

export interface ClassRate { classId: string | number; name: string; rate: number; marked: number }

/** Present / marked for each class across its sessions. */
export function rateByClass(classes: ClassDoc[], sessions: SessionDoc[], records: RecordDoc[]): ClassRate[] {
  const sessionClass = new Map(sessions.map((s) => [String(s.id), String(idOf(s.class))]))
  const acc = new Map<string, { present: number; marked: number }>()
  for (const r of records) {
    const classId = sessionClass.get(String(idOf(r.session)))
    if (!classId) continue
    const cur = acc.get(classId) ?? { present: 0, marked: 0 }
    cur.marked += 1
    if (r.status === 'present') cur.present += 1
    acc.set(classId, cur)
  }
  return classes.map((c) => {
    const v = acc.get(String(c.id)) ?? { present: 0, marked: 0 }
    return { classId: c.id, name: c.name, rate: v.marked ? v.present / v.marked : 0, marked: v.marked }
  })
}

export function statusBreakdown(records: RecordDoc[]): Record<Status, number> {
  const out: Record<Status, number> = { present: 0, absent: 0, late: 0, excused: 0 }
  for (const r of records) if (r.status in out) out[r.status] += 1
  return out
}

export interface ClassCount { classId: string | number; name: string; count: number }

export function enrollmentByClass(classes: ClassDoc[], enrollments: EnrollmentDoc[]): ClassCount[] {
  const acc = new Map<string, number>()
  for (const e of enrollments) {
    if (e.status && e.status !== 'active') continue
    const k = String(idOf(e.class))
    acc.set(k, (acc.get(k) ?? 0) + 1)
  }
  return classes.map((c) => ({ classId: c.id, name: c.name, count: acc.get(String(c.id)) ?? 0 }))
}

export interface Kpis { students: number; activeClasses: number; avgAttendanceRate: number; sessionsHeld: number; sessionsUpcoming: number }

export function dashboardKpis(input: {
  students: { id: string | number }[]
  classes: ClassDoc[]
  sessions: SessionDoc[]
  records: RecordDoc[]
  today: string
}): Kpis {
  const heldIds = new Set(input.records.map((r) => String(idOf(r.session))))
  const present = input.records.filter((r) => r.status === 'present').length
  const marked = input.records.length
  const upcoming = input.sessions.filter((s) => !heldIds.has(String(s.id)) && day(s.date) >= input.today).length
  return {
    students: input.students.length,
    activeClasses: input.classes.length,
    avgAttendanceRate: marked ? present / marked : 0,
    sessionsHeld: heldIds.size,
    sessionsUpcoming: upcoming,
  }
}

export function canHardDelete(history: { sessionCount: number; attendanceCount: number; enrollmentCount: number }): boolean {
  return history.sessionCount === 0 && history.attendanceCount === 0 && history.enrollmentCount === 0
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/lib/school-reports.test.ts` → PASS. Then `npm test` → all pass. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/school-reports.ts tests/lib/school-reports.test.ts
git commit -m "feat(school): pure attendance/report aggregation functions"
```

---

## Task 3: SVG chart components + styles

**Files:**
- Create: `src/admin/school/charts/Donut.tsx`, `Bars.tsx`, `AreaTrend.tsx`
- Modify: `src/admin/school/sunday-school.css` (chart styles)

- [ ] **Step 1: Donut**

Create `src/admin/school/charts/Donut.tsx`:

```tsx
'use client'
import React from 'react'

export interface DonutSeg { label: string; value: number; color: string }

const Donut: React.FC<{ segments: DonutSeg[]; size?: number }> = ({ segments, size = 132 }) => {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const r = size / 2 - 12
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="ss-chart__donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Attendance status breakdown">
        <g transform={`translate(${size / 2},${size / 2}) rotate(-90)`}>
          <circle r={r} fill="none" stroke="var(--theme-elevation-100)" strokeWidth={14} />
          {total > 0 && segments.map((s) => {
            const len = (s.value / total) * c
            const seg = <circle key={s.label} r={r} fill="none" stroke={s.color} strokeWidth={14}
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} strokeLinecap="butt" />
            offset += len
            return seg
          })}
        </g>
        <text x="50%" y="48%" textAnchor="middle" className="ss-chart__donutnum">{total}</text>
        <text x="50%" y="62%" textAnchor="middle" className="ss-chart__donutlbl">marks</text>
      </svg>
      <ul className="ss-chart__legend">
        {segments.map((s) => (
          <li key={s.label}><span style={{ background: s.color }} /> {s.label} <b>{s.value}</b></li>
        ))}
      </ul>
    </div>
  )
}

export default Donut
```

- [ ] **Step 2: Bars**

Create `src/admin/school/charts/Bars.tsx`:

```tsx
'use client'
import React from 'react'

export interface BarRow { label: string; value: number; display?: string }

/** Horizontal bars. `mode='ratio'` expects values in 0..1 and shows a %. */
const Bars: React.FC<{ rows: BarRow[]; color?: string; mode?: 'count' | 'ratio' }> = ({ rows, color = 'var(--ss-teal-500)', mode = 'count' }) => {
  const max = mode === 'ratio' ? 1 : Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) return <p className="ss-emptyline">No data yet.</p>
  return (
    <div className="ss-chart__bars">
      {rows.map((r) => (
        <div key={r.label} className="ss-chart__bar">
          <span className="ss-chart__barlabel" title={r.label}>{r.label}</span>
          <span className="ss-chart__bartrack">
            <span className="ss-chart__barfill" style={{ width: `${Math.min(100, (r.value / max) * 100)}%`, background: color }} />
          </span>
          <span className="ss-chart__barval">{r.display ?? (mode === 'ratio' ? `${Math.round(r.value * 100)}%` : r.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default Bars
```

- [ ] **Step 3: AreaTrend**

Create `src/admin/school/charts/AreaTrend.tsx`:

```tsx
'use client'
import React from 'react'

export interface TrendDatum { label: string; value: number } // value 0..1

const AreaTrend: React.FC<{ data: TrendDatum[]; height?: number }> = ({ data, height = 120 }) => {
  if (data.length === 0) return <p className="ss-emptyline">No attendance recorded yet.</p>
  const w = 480
  const pad = 6
  const n = data.length
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (n - 1))
  const y = (v: number) => height - pad - v * (height - 2 * pad)
  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`
  return (
    <svg className="ss-chart__area" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Attendance trend">
      <defs>
        <linearGradient id="ss-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ss-teal-500)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--ss-teal-500)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ss-area-grad)" />
      <path d={line} fill="none" stroke="var(--ss-teal-500)" strokeWidth={2} strokeLinejoin="round" />
      {data.map((d, i) => <circle key={d.label} cx={x(i)} cy={y(d.value)} r={2.5} fill="var(--ss-teal-600)" />)}
    </svg>
  )
}

export default AreaTrend
```

- [ ] **Step 4: Chart styles**

Append to `src/admin/school/sunday-school.css`:

```css
/* charts */
.ss-chart__donut { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.ss-chart__donutnum { font-family: var(--ss-serif); font-weight: 600; font-size: 22px; fill: var(--theme-elevation-900); }
.ss-chart__donutlbl { font-size: 9px; letter-spacing: 0.08em; text-transform: uppercase; fill: var(--theme-elevation-500); }
.ss-chart__legend { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
.ss-chart__legend li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--theme-elevation-700); }
.ss-chart__legend li span { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
.ss-chart__legend li b { margin-left: auto; font-weight: 700; }
.ss-chart__bars { display: grid; gap: 10px; }
.ss-chart__bar { display: grid; grid-template-columns: 120px 1fr 44px; align-items: center; gap: 10px; }
.ss-chart__barlabel { font-size: 13px; color: var(--theme-elevation-700); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ss-chart__bartrack { height: 10px; border-radius: 999px; background: var(--theme-elevation-100); overflow: hidden; }
.ss-chart__barfill { display: block; height: 100%; border-radius: 999px; transition: width 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); }
.ss-chart__barval { font-size: 12.5px; font-weight: 600; color: var(--theme-elevation-700); text-align: right; }
.ss-chart__area { width: 100%; height: auto; display: block; }
@media (prefers-reduced-motion: reduce) { .ss-chart__barfill { transition: none; } }
```

- [ ] **Step 5: Typecheck + commit**

Run `npx tsc --noEmit` (clean). Charts are presentational (no tests).
```bash
git add src/admin/school/charts/ src/admin/school/sunday-school.css
git commit -m "feat(school): hand-rolled SVG chart components"
```

---

## Task 4: Persistent tab bar

**Files:**
- Create: `src/admin/school/SchoolTabs.tsx`
- Modify: `src/admin/school/sunday-school.css` (tab styles)

- [ ] **Step 1: Component**

Create `src/admin/school/SchoolTabs.tsx`:

```tsx
'use client'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, GraduationCap, Users, ClipboardList, Wand2 } from 'lucide-react'

// `soon: true` marks a tab whose route ships in Phase 2 — rendered disabled so
// there are no dead links. Drop the flag when the route exists.
const TABS = [
  { href: '/admin/sunday-school', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/sunday-school/classes', label: 'Classes', icon: GraduationCap },
  { href: '/admin/sunday-school/students', label: 'Students', icon: Users, soon: true },
  { href: '/admin/sunday-school/attendance', label: 'Attendance', icon: ClipboardList, soon: true },
  { href: '/admin/sunday-school/setup', label: 'Setup', icon: Wand2 },
]

const SchoolTabs: React.FC = () => {
  const path = usePathname()
  return (
    <nav className="ss-tabs" aria-label="Sunday school sections">
      {TABS.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href)
        const Icon = t.icon
        if (t.soon) {
          return (
            <span key={t.href} className="ss-tab ss-tab--soon" aria-disabled="true" title="Coming soon">
              <Icon size={16} /> {t.label} <span className="ss-tab__soon">soon</span>
            </span>
          )
        }
        return (
          <Link key={t.href} href={t.href} className={`ss-tab${active ? ' ss-tab--active' : ''}`} aria-current={active ? 'page' : undefined}>
            <Icon size={16} /> {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default SchoolTabs
```

- [ ] **Step 2: Tab styles**

Append to `src/admin/school/sunday-school.css`:

```css
/* tabs */
.ss-tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--theme-elevation-150); margin-bottom: 22px; }
.ss-tab {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 10px 14px; font-size: 14px; font-weight: 600; text-decoration: none;
  color: var(--theme-elevation-600); border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color 0.14s ease, border-color 0.14s ease;
}
.ss-tab:hover { color: var(--theme-elevation-900); }
.ss-tab--active { color: var(--ss-teal-600); border-bottom-color: var(--ss-teal-500); }
.ss-tab--soon { color: var(--theme-elevation-400); cursor: default; }
.ss-tab--soon:hover { color: var(--theme-elevation-400); }
.ss-tab__soon { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 6px; border-radius: 999px; background: var(--theme-elevation-100); color: var(--theme-elevation-500); }
```

- [ ] **Step 3: Typecheck + commit**

Run `npx tsc --noEmit` (clean).
```bash
git add src/admin/school/SchoolTabs.tsx src/admin/school/sunday-school.css
git commit -m "feat(school): management tab bar"
```

---

## Task 5: Dashboard route + clients

**Files:**
- Modify: `src/app/(payload)/admin/sunday-school/page.tsx`
- Create: `src/admin/school/dashboard/DashboardClient.tsx`, `src/admin/school/dashboard/TeacherDashboard.tsx`

- [ ] **Step 1: TeacherDashboard (trimmed)**

Create `src/admin/school/dashboard/TeacherDashboard.tsx`:

```tsx
'use client'
import React from 'react'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import '../sunday-school.css'

const TeacherDashboard: React.FC<{ termName: string | null; classes: { id: string | number; name: string }[] }> = ({ termName, classes }) => (
  <div className="ss-root">
    <p className="ss-eyebrow">Sunday school{termName ? ` · ${termName}` : ''}</p>
    <h1 className="ss-display" style={{ fontSize: 28, marginBottom: 18 }}>Your classes</h1>
    {classes.length === 0 && <p className="ss-emptyline">You have no classes assigned yet.</p>}
    <div className="ss-card" style={{ padding: '8px 14px' }}>
      {classes.map((c) => (
        <div key={c.id} className="ss-row">
          <span className="ss-row__name">{c.name}</span>
          <Link className="ss-btn ss-btn--ghost ss-btn--small" href="/admin/take-attendance"><ClipboardCheck size={15} /> Take attendance</Link>
        </div>
      ))}
    </div>
  </div>
)

export default TeacherDashboard
```

- [ ] **Step 2: DashboardClient**

Create `src/admin/school/dashboard/DashboardClient.tsx`:

```tsx
'use client'
import React from 'react'
import Link from 'next/link'
import { Users, GraduationCap, Percent, CalendarCheck, AlertTriangle } from 'lucide-react'
import SchoolTabs from '../SchoolTabs'
import SessionTimeline from '../SessionTimeline'
import Donut from '../charts/Donut'
import Bars from '../charts/Bars'
import AreaTrend from '../charts/AreaTrend'
import type { Kpis, TrendPoint, ClassRate, ClassCount, Status } from '@/lib/school-reports'
import '../sunday-school.css'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${MONTHS[(m ?? 1) - 1]} ${d}` }

export interface DashboardData {
  term: { name: string; startDate?: string | null; endDate?: string | null; meetingDay?: string | null; holidays: string[] } | null
  kpis: Kpis
  trend: TrendPoint[]
  rateByClass: ClassRate[]
  statusBreakdown: Record<Status, number>
  enrollmentByClass: ClassCount[]
  attention: { teacherlessClasses: number; unplacedStudents: number }
}

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="ss-card ss-panel">
    <p className="ss-eyebrow">{title}</p>
    {children}
  </div>
)

const DashboardClient: React.FC<{ data: DashboardData }> = ({ data }) => {
  const { term, kpis } = data
  if (!term) {
    return (
      <div className="ss-root">
        <SchoolTabs />
        <section className="ss-empty">
          <p className="ss-eyebrow">Sunday school</p>
          <h1 className="ss-empty__title">No active term yet</h1>
          <p className="ss-empty__body">Set up a term to unlock the dashboard.</p>
          <Link className="ss-btn" href="/admin/sunday-school/setup?step=1">Start setup</Link>
        </section>
      </div>
    )
  }
  return (
    <div className="ss-root">
      <SchoolTabs />
      <header className="ss-masthead">
        <p className="ss-eyebrow">Current term</p>
        <h1 className="ss-masthead__title">{term.name}</h1>
        <SessionTimeline startDate={term.startDate} endDate={term.endDate} meetingDay={term.meetingDay} holidays={term.holidays} variant="masthead" />
      </header>

      <div className="ss-stats">
        <div className="ss-stat"><span className="ss-stat__icon"><Users size={19} /></span><div className="ss-stat__num">{kpis.students}</div><div className="ss-stat__label">students</div></div>
        <div className="ss-stat"><span className="ss-stat__icon"><GraduationCap size={19} /></span><div className="ss-stat__num">{kpis.activeClasses}</div><div className="ss-stat__label">active classes</div></div>
        <div className="ss-stat ss-stat--good"><span className="ss-stat__icon"><Percent size={19} /></span><div className="ss-stat__num">{Math.round(kpis.avgAttendanceRate * 100)}%</div><div className="ss-stat__label">avg attendance</div></div>
        <div className="ss-stat"><span className="ss-stat__icon"><CalendarCheck size={19} /></span><div className="ss-stat__num">{kpis.sessionsHeld}</div><div className="ss-stat__label">sessions held · {kpis.sessionsUpcoming} upcoming</div></div>
      </div>

      {(data.attention.teacherlessClasses > 0 || data.attention.unplacedStudents > 0) && (
        <div className="ss-attention">
          <AlertTriangle size={16} />
          <span>
            {data.attention.teacherlessClasses > 0 && <Link href="/admin/sunday-school/classes">{data.attention.teacherlessClasses} class(es) without a teacher</Link>}
            {data.attention.teacherlessClasses > 0 && data.attention.unplacedStudents > 0 && ' · '}
            {data.attention.unplacedStudents > 0 && <Link href="/admin/sunday-school/setup?step=4">{data.attention.unplacedStudents} student(s) to place</Link>}
          </span>
        </div>
      )}

      <div className="ss-grid2">
        <Card title="Attendance trend">
          <AreaTrend data={data.trend.map((t) => ({ label: shortDate(t.date), value: t.presentRate }))} />
        </Card>
        <Card title="Status breakdown">
          <Donut segments={[
            { label: 'Present', value: data.statusBreakdown.present, color: 'var(--ss-teal-500)' },
            { label: 'Late', value: data.statusBreakdown.late, color: 'var(--ss-gold-500)' },
            { label: 'Excused', value: data.statusBreakdown.excused, color: 'var(--theme-elevation-400)' },
            { label: 'Absent', value: data.statusBreakdown.absent, color: 'var(--theme-error-500, #d4584c)' },
          ]} />
        </Card>
        <Card title="Attendance rate by class">
          <Bars mode="ratio" rows={data.rateByClass.map((r) => ({ label: r.name, value: r.rate }))} />
        </Card>
        <Card title="Enrollment by class">
          <Bars rows={data.enrollmentByClass.map((r) => ({ label: r.name, value: r.count }))} color="var(--ss-navy-700)" />
        </Card>
      </div>
    </div>
  )
}

export default DashboardClient
```

- [ ] **Step 3: Dashboard styles**

Append to `src/admin/school/sunday-school.css`:

```css
.ss-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 18px; }
.ss-panel { padding: 18px 20px; }
.ss-attention {
  display: flex; align-items: center; gap: 8px; margin-top: 16px;
  padding: 10px 14px; border-radius: 10px; font-size: 13.5px;
  background: var(--ss-gold-wash); color: var(--ss-gold-700);
}
.ss-attention a { color: inherit; font-weight: 700; text-decoration: underline; }
@media (max-width: 860px) { .ss-grid2 { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Rewrite the Dashboard route**

Replace the body of `src/app/(payload)/admin/sunday-school/page.tsx` to aggregate sessions + records and branch on role. Keep the existing imports block (DefaultTemplate, getPayload, isEntityHidden, getAdminUser, loginUrl, importMap, idOf, visibleEntities) and ADD:

```ts
import DashboardClient, { type DashboardData } from '@/admin/school/dashboard/DashboardClient'
import TeacherDashboard from '@/admin/school/dashboard/TeacherDashboard'
import { attendanceTrend, rateByClass, statusBreakdown, enrollmentByClass, dashboardKpis } from '@/lib/school-reports'
```

Remove the `HubClient` / `buildHubSummary` imports. After computing `term` and `tenantId`, replace the data-loading + render with:

```ts
  const today = new Date().toISOString().slice(0, 10)

  // Teacher: trimmed view of their own classes.
  if (role === 'teacher') {
    const myClasses = term
      ? (await payload.find({ collection: 'school-classes', where: { term: { equals: term.id }, status: { equals: 'active' } }, limit: 1000, depth: 0, req })).docs
      : []
    return (
      <DefaultTemplate i18n={req.i18n} params={{}} payload={payload} permissions={permissions as SanitizedPermissions} req={req} searchParams={{}} user={user} visibleEntities={visibleEntities}>
        <TeacherDashboard termName={term?.name ?? null} classes={myClasses.map((c: any) => ({ id: c.id, name: c.name }))} />
      </DefaultTemplate>
    )
  }

  let dashboard: DashboardData = {
    term: null,
    kpis: { students: 0, activeClasses: 0, avgAttendanceRate: 0, sessionsHeld: 0, sessionsUpcoming: 0 },
    trend: [], rateByClass: [], statusBreakdown: { present: 0, absent: 0, late: 0, excused: 0 }, enrollmentByClass: [],
    attention: { teacherlessClasses: 0, unplacedStudents: 0 },
  }

  if (term) {
    const classes = (await payload.find({ collection: 'school-classes', where: { term: { equals: term.id }, status: { equals: 'active' } }, limit: 1000, depth: 0, req })).docs
    const classIds = classes.map((c: any) => c.id)
    const sessions = classIds.length ? (await payload.find({ collection: 'class-sessions', where: { class: { in: classIds } }, limit: 10000, depth: 0, req })).docs : []
    const sessionIds = sessions.map((s: any) => s.id)
    const records = sessionIds.length ? (await payload.find({ collection: 'attendance-records', where: { session: { in: sessionIds } }, limit: 50000, depth: 0, req })).docs : []
    const enrollments = classIds.length ? (await payload.find({ collection: 'enrollments', where: { class: { in: classIds } }, limit: 10000, depth: 0, req })).docs : []
    const students = (await payload.find({ collection: 'students', where: { status: { equals: 'active' } }, limit: 10000, depth: 0, req })).docs

    const classDocs = classes.map((c: any) => ({ id: c.id, name: c.name }))
    const sessDocs = sessions.map((s: any) => ({ id: s.id, class: s.class, date: s.date }))
    const recDocs = records.map((r: any) => ({ session: r.session, status: r.status }))
    const teacherless = classes.filter((c: any) => !c.teachers || c.teachers.length === 0).length
    const placed = new Set(enrollments.filter((e: any) => e.status === 'active').map((e: any) => String(typeof e.student === 'object' ? e.student.id : e.student)))
    const unplaced = students.filter((s: any) => !placed.has(String(s.id))).length

    dashboard = {
      term: { name: term.name, startDate: term.startDate, endDate: term.endDate, meetingDay: (term as any).meetingDay, holidays: ((term as any).holidays ?? []).map((h: any) => String(h.date).slice(0, 10)) },
      kpis: dashboardKpis({ students, classes: classDocs, sessions: sessDocs, records: recDocs, today }),
      trend: attendanceTrend(sessDocs, recDocs),
      rateByClass: rateByClass(classDocs, sessDocs, recDocs),
      statusBreakdown: statusBreakdown(recDocs),
      enrollmentByClass: enrollmentByClass(classDocs, enrollments.map((e: any) => ({ class: e.class, status: e.status }))),
      attention: { teacherlessClasses: teacherless, unplacedStudents: unplaced },
    }
  }

  return (
    <DefaultTemplate i18n={req.i18n} params={{}} payload={payload} permissions={permissions as SanitizedPermissions} req={req} searchParams={{}} user={user} visibleEntities={visibleEntities}>
      <DashboardClient data={dashboard} />
    </DefaultTemplate>
  )
```

(Delete the old `classes/enrollments/students/sessionsPerClass/summary` block and the old `HubClient` return.) The old `HubClient.tsx`, `buildHubSummary`, and `firstIncompleteStep` remain used by the wizard — do NOT delete them.

- [ ] **Step 5: Typecheck, build, commit**

Run `npx tsc --noEmit` (clean) and `npm test` (all pass). Boot dev (`npm run dev`) and confirm `/admin/sunday-school` compiles.
```bash
git add "src/app/(payload)/admin/sunday-school/page.tsx" src/admin/school/dashboard/ src/admin/school/sunday-school.css
git commit -m "feat(school): analytics dashboard with charts + teacher view"
```

---

## Task 6: Classes list

**Files:**
- Create: `src/app/(payload)/admin/sunday-school/classes/page.tsx`
- Create: `src/admin/school/classes/ClassesClient.tsx`

- [ ] **Step 1: Route**

Create `src/app/(payload)/admin/sunday-school/classes/page.tsx`. Copy the gating + `DefaultTemplate` shape from the dashboard route, but importMap is `../../importMap`, the segments are `['sunday-school','classes']`, gate to `['platformOwner','admin','school_admin']` (teacher → redirect to `/admin/sunday-school`), and pass the active term id to the client:

```tsx
import { redirect } from 'next/navigation'
import { createLocalReq, getPayload, isEntityHidden, type SanitizedPermissions, type VisibleEntities } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { getAdminUser } from '@/lib/admin-context'
import { loginUrl } from '@/lib/login-redirect'
import { importMap } from '../../importMap'
import ClassesClient from '@/admin/school/classes/ClassesClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const ROLES = new Set(['platformOwner', 'admin', 'school_admin'])
const idOf = (v: unknown): string | number | null => v == null ? null : typeof v === 'object' && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

export default async function ClassesPage() {
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl('/admin/sunday-school/classes'))
  const role = (user as { role?: string }).role
  if (!role || !ROLES.has(role)) redirect('/admin/sunday-school')

  const payload = await getPayload({ config, importMap })
  const req = await createLocalReq({ user }, payload)
  const visibleEntities: VisibleEntities = {
    collections: payload.config.collections.filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user })).map(({ slug }) => slug),
    globals: payload.config.globals.filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user })).map(({ slug }) => slug),
  }
  const tenantId = idOf((user as { tenant?: unknown }).tenant)
  const termRes = await payload.find({ collection: 'terms', where: { status: { equals: 'active' }, ...(tenantId ? { tenant: { equals: tenantId } } : {}) }, sort: '-startDate', limit: 1, depth: 0, req })
  const term = termRes.docs[0] ?? null

  return (
    <DefaultTemplate i18n={req.i18n} params={{}} payload={payload} permissions={permissions as SanitizedPermissions} req={req} searchParams={{}} user={user} visibleEntities={visibleEntities}>
      <ClassesClient termId={term ? String(term.id) : null} termName={term?.name ?? null} />
    </DefaultTemplate>
  )
}
```

- [ ] **Step 2: Client**

Create `src/admin/school/classes/ClassesClient.tsx`:

```tsx
'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, ChevronRight, Archive } from 'lucide-react'
import { api, toId } from '../api'
import SchoolTabs from '../SchoolTabs'
import '../sunday-school.css'

interface Row { id: string | number; name: string; gradeLevel?: string; teachers?: any[]; enrolled: number; sessions: number; status: string }

const ClassesClient: React.FC<{ termId: string | null; termName: string | null }> = ({ termId, termName }) => {
  const [rows, setRows] = useState<Row[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!termId) { setRows([]); setLoading(false); return }
    setLoading(true)
    const cl = (await api(`/school-classes?where[term][equals]=${termId}&limit=1000&depth=1&sort=name`)).docs
    const out: Row[] = []
    for (const c of cl) {
      const enr = await api(`/enrollments?where[class][equals]=${c.id}&where[status][equals]=active&limit=0&depth=0`)
      const ses = await api(`/class-sessions?where[class][equals]=${c.id}&limit=0&depth=0`)
      out.push({ id: c.id, name: c.name, gradeLevel: c.gradeLevel, teachers: c.teachers, enrolled: enr.totalDocs ?? 0, sessions: ses.totalDocs ?? 0, status: c.status ?? 'active' })
    }
    setRows(out); setLoading(false)
  }, [termId])

  useEffect(() => { reload().catch(() => setLoading(false)) }, [reload])

  const add = async () => {
    if (!termId || !name) return
    setBusy(true)
    try {
      const data: any = { name, term: toId(termId), status: 'active' }
      if (grade) data.gradeLevel = grade
      await api('/school-classes', { method: 'POST', body: JSON.stringify(data) })
      setName(''); setGrade(''); await reload()
    } finally { setBusy(false) }
  }

  const teacherLabel = (c: Row) => {
    const t = Array.isArray(c.teachers) ? c.teachers[0] : null
    return t ? (typeof t === 'object' ? (t.email ?? 'Assigned') : 'Assigned') : null
  }

  const visible = rows.filter((r) => (showArchived ? true : r.status === 'active'))

  return (
    <div className="ss-root">
      <SchoolTabs />
      <div className="ss-att__bar">
        <div>
          <p className="ss-eyebrow">{termName ?? 'No active term'}</p>
          <h1 className="ss-display" style={{ fontSize: 26 }}>Classes</h1>
        </div>
        <label className="ss-row__name" style={{ flex: 'none', display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
        </label>
      </div>

      {!termId && <p className="ss-emptyline">Create a term first in Setup.</p>}
      {termId && loading && <p className="ss-emptyline">Loading…</p>}

      {termId && !loading && (
        <>
          <div className="ss-card" style={{ padding: '8px 14px', marginBottom: 16 }}>
            {visible.length === 0 && <p className="ss-emptyline">No classes yet.</p>}
            {visible.map((c) => (
              <Link key={c.id} href={`/admin/sunday-school/classes/${c.id}`} className="ss-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="ss-row__name">
                  {c.name}{c.gradeLevel ? ` · ${c.gradeLevel}` : ''}
                  {c.status === 'archived' && <span className="ss-pill ss-pill--muted" style={{ marginLeft: 8 }}><Archive size={12} /> archived</span>}
                </span>
                <span className="ss-pill ss-pill--muted">{c.enrolled} students</span>
                <span className="ss-pill ss-pill--muted">{c.sessions} sessions</span>
                <span className="ss-pill">{teacherLabel(c) ?? 'No teacher'}</span>
                <ChevronRight size={16} style={{ color: 'var(--theme-elevation-400)' }} />
              </Link>
            ))}
          </div>

          <div className="ss-card ss-panel">
            <p className="ss-eyebrow">New class</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="ss-input" style={{ maxWidth: 260 }} placeholder="Class name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="ss-input" style={{ maxWidth: 180 }} placeholder="Grade (optional)" value={grade} onChange={(e) => setGrade(e.target.value)} />
              <button className="ss-btn" disabled={busy || !name} onClick={add}><Plus size={16} /> Add class</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ClassesClient
```

- [ ] **Step 3: Typecheck + commit**

Run `npx tsc --noEmit` (clean) and `npm test` (all pass). Boot dev; confirm `/admin/sunday-school/classes` compiles.
```bash
git add "src/app/(payload)/admin/sunday-school/classes/page.tsx" src/admin/school/classes/ClassesClient.tsx
git commit -m "feat(school): classes list view"
```

---

## Task 7: Class detail — edit, status, sessions

**Files:**
- Create: `src/app/(payload)/admin/sunday-school/classes/[id]/page.tsx`
- Create: `src/admin/school/classes/ClassDetailClient.tsx`

- [ ] **Step 1: Route**

Create `src/app/(payload)/admin/sunday-school/classes/[id]/page.tsx` (importMap depth `../../../importMap`, segments `['sunday-school','classes','[id]']`, same gating). It passes the route id to the client:

```tsx
import { redirect } from 'next/navigation'
import { createLocalReq, getPayload, isEntityHidden, type SanitizedPermissions, type VisibleEntities } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { getAdminUser } from '@/lib/admin-context'
import { loginUrl } from '@/lib/login-redirect'
import { importMap } from '../../../importMap'
import ClassDetailClient from '@/admin/school/classes/ClassDetailClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const ROLES = new Set(['platformOwner', 'admin', 'school_admin'])

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, permissions } = await getAdminUser()
  if (!user) redirect(loginUrl(`/admin/sunday-school/classes/${id}`))
  const role = (user as { role?: string }).role
  if (!role || !ROLES.has(role)) redirect('/admin/sunday-school')

  const payload = await getPayload({ config, importMap })
  const req = await createLocalReq({ user }, payload)
  const visibleEntities: VisibleEntities = {
    collections: payload.config.collections.filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user })).map(({ slug }) => slug),
    globals: payload.config.globals.filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user })).map(({ slug }) => slug),
  }

  return (
    <DefaultTemplate i18n={req.i18n} params={{}} payload={payload} permissions={permissions as SanitizedPermissions} req={req} searchParams={{}} user={user} visibleEntities={visibleEntities}>
      <ClassDetailClient classId={id} />
    </DefaultTemplate>
  )
}
```

- [ ] **Step 2: Client (edit + status + sessions)**

Create `src/admin/school/classes/ClassDetailClient.tsx`:

```tsx
'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Archive, ArchiveRestore, Trash2, Ban, RotateCcw } from 'lucide-react'
import { api, toId } from '../api'
import { canHardDelete } from '@/lib/school-reports'
import SchoolTabs from '../SchoolTabs'
import '../sunday-school.css'

const ClassDetailClient: React.FC<{ classId: string }> = ({ classId }) => {
  const router = useRouter()
  const [klass, setKlass] = useState<any>(null)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [room, setRoom] = useState('')
  const [capacity, setCap] = useState('')
  const [sessions, setSessions] = useState<any[]>([])
  const [counts, setCounts] = useState<{ enroll: number; att: number }>({ enroll: 0, att: 0 })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const c = await api(`/school-classes/${classId}?depth=0`)
    setKlass(c); setName(c.name ?? ''); setGrade(c.gradeLevel ?? ''); setRoom(c.room ?? ''); setCap(c.capacity != null ? String(c.capacity) : '')
    const ses = (await api(`/class-sessions?where[class][equals]=${classId}&sort=date&limit=1000&depth=0`)).docs
    setSessions(ses)
    const enr = await api(`/enrollments?where[class][equals]=${classId}&limit=0&depth=0`)
    const sessIds = ses.map((s: any) => s.id)
    const att = sessIds.length ? await api(`/attendance-records?where[session][in]=${sessIds.join(',')}&limit=0&depth=0`) : { totalDocs: 0 }
    setCounts({ enroll: enr.totalDocs ?? 0, att: att.totalDocs ?? 0 })
  }, [classId])

  useEffect(() => { load().catch(() => setMsg('Could not load this class.')) }, [load])

  const saveClass = async () => {
    setMsg('')
    const data: any = { name, gradeLevel: grade || null, room: room || null, capacity: capacity ? Number(capacity) : null }
    await api(`/school-classes/${classId}`, { method: 'PATCH', body: JSON.stringify(data) })
    setMsg('Saved.'); await load()
  }
  const setStatus = async (status: 'active' | 'archived') => {
    await api(`/school-classes/${classId}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load()
  }
  const hardDelete = async () => {
    if (!canHardDelete({ sessionCount: sessions.length, attendanceCount: counts.att, enrollmentCount: counts.enroll })) {
      setMsg('This class has history — archive it instead of deleting.'); return
    }
    if (!confirm('Delete this class? This cannot be undone.')) return
    await api(`/school-classes/${classId}`, { method: 'DELETE' })
    router.push('/admin/sunday-school/classes')
  }
  const setSessionStatus = async (id: string | number, status: string) => {
    await api(`/class-sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load()
  }

  if (!klass) return <div className="ss-root"><SchoolTabs /><p className="ss-emptyline">{msg || 'Loading…'}</p></div>

  const archived = klass.status === 'archived'
  const hardOk = canHardDelete({ sessionCount: sessions.length, attendanceCount: counts.att, enrollmentCount: counts.enroll })

  return (
    <div className="ss-root">
      <SchoolTabs />
      <Link className="ss-btn ss-btn--ghost ss-btn--small" href="/admin/sunday-school/classes" style={{ marginBottom: 12 }}><ArrowLeft size={15} /> All classes</Link>
      <h1 className="ss-display" style={{ fontSize: 26, marginBottom: 18 }}>{klass.name}</h1>

      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Class details</p>
        <div className="ss-grid">
          <label className="ss-field"><span>Name</span><input className="ss-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="ss-field"><span>Grade level</span><input className="ss-input" value={grade} onChange={(e) => setGrade(e.target.value)} /></label>
          <label className="ss-field"><span>Room</span><input className="ss-input" value={room} onChange={(e) => setRoom(e.target.value)} /></label>
          <label className="ss-field"><span>Capacity</span><input className="ss-input" type="number" value={capacity} onChange={(e) => setCap(e.target.value)} /></label>
        </div>
        <div className="ss-foot">
          <button className="ss-btn" onClick={saveClass}><Save size={16} /> Save</button>
          {archived
            ? <button className="ss-btn ss-btn--ghost" onClick={() => setStatus('active')}><ArchiveRestore size={16} /> Restore</button>
            : <button className="ss-btn ss-btn--ghost" onClick={() => setStatus('archived')}><Archive size={16} /> Archive</button>}
          <button className="ss-btn ss-btn--ghost" onClick={hardDelete} disabled={!hardOk} title={hardOk ? 'Delete' : 'Has history — archive instead'}><Trash2 size={16} /> Delete</button>
        </div>
        {msg && <p className="ss-note">{msg}</p>}
      </div>

      <div className="ss-card ss-panel">
        <p className="ss-eyebrow">Sessions · {sessions.length}</p>
        {sessions.length === 0 && <p className="ss-emptyline">No sessions.</p>}
        {sessions.map((s) => (
          <div key={s.id} className="ss-row">
            <span className="ss-row__name">{String(s.date).slice(0, 10)}</span>
            <span className={`ss-pill${s.status === 'cancelled' ? ' ss-pill--muted' : ''}`}>{s.status}</span>
            <Link className="ss-btn ss-btn--ghost ss-btn--small" href="/admin/take-attendance">Attendance</Link>
            {s.status === 'cancelled'
              ? <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => setSessionStatus(s.id, 'scheduled')}><RotateCcw size={14} /> Reactivate</button>
              : <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => setSessionStatus(s.id, 'cancelled')}><Ban size={14} /> Cancel</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ClassDetailClient
```

- [ ] **Step 3: Typecheck + commit**

Run `npx tsc --noEmit` (clean) and `npm test`. Boot dev; confirm `/admin/sunday-school/classes/<id>` compiles.
```bash
git add "src/app/(payload)/admin/sunday-school/classes/[id]/page.tsx" src/admin/school/classes/ClassDetailClient.tsx
git commit -m "feat(school): class detail — edit, archive, sessions"
```

---

## Task 8: Class detail — roster + teacher panels

**Files:**
- Modify: `src/admin/school/classes/ClassDetailClient.tsx`

- [ ] **Step 1: Add roster + teacher state and loaders**

In `ClassDetailClient.tsx`, extend `load()` to also fetch the roster, all classes (for "move"), and teachers. Add state near the top:

```tsx
  const [roster, setRoster] = useState<any[]>([]) // active enrollments w/ student
  const [allClasses, setAllClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [unplaced, setUnplaced] = useState<any[]>([])
```

At the end of `load()` (before the closing), add:

```tsx
    const term = typeof klassDoc.term === 'object' ? klassDoc.term?.id : klassDoc.term
    const enrRes = (await api(`/enrollments?where[class][equals]=${classId}&where[status][equals]=active&limit=1000&depth=1`)).docs
    setRoster(enrRes)
    setAllClasses((await api(`/school-classes?where[term][equals]=${term}&where[status][equals]=active&limit=1000&depth=0`)).docs)
    setTeachers((await api('/users?where[role][equals]=teacher&limit=1000&depth=0')).docs)
    const placedIds = new Set(
      ((await api(`/enrollments?where[class][in]=${(await api(`/school-classes?where[term][equals]=${term}&limit=1000&depth=0`)).docs.map((c: any) => c.id).join(',')}&where[status][equals]=active&limit=5000&depth=0`)).docs)
        .map((e: any) => String(typeof e.student === 'object' ? e.student.id : e.student)),
    )
    setUnplaced((await api('/students?where[status][equals]=active&limit=5000&depth=0')).docs.filter((s: any) => !placedIds.has(String(s.id))))
```

where `klassDoc` is the class doc fetched at the top of `load()` — rename the existing `const c = await api(...)` to `const klassDoc = await api(...)` and update the `setKlass(klassDoc)`/field setters accordingly.

- [ ] **Step 2: Add roster + teacher actions**

Add these handlers inside the component:

```tsx
  const enroll = async (studentId: string | number) => {
    await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(studentId), class: toId(classId), status: 'active' }) }); await load()
  }
  const withdraw = async (enrollmentId: string | number) => {
    await api(`/enrollments/${enrollmentId}`, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn' }) }); await load()
  }
  const move = async (enrollmentId: string | number, toClass: string) => {
    if (!toClass) return
    await api(`/enrollments/${enrollmentId}`, { method: 'PATCH', body: JSON.stringify({ class: toId(toClass) }) }); await load()
  }
  const setTeacher = async (teacherId: string) => {
    await api(`/school-classes/${classId}`, { method: 'PATCH', body: JSON.stringify({ teachers: teacherId ? [toId(teacherId)] : [] }) }); await load()
  }
```

- [ ] **Step 3: Render roster + teacher panels**

Insert these two panels in the returned JSX, between the "Class details" card and the "Sessions" card:

```tsx
      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Teacher</p>
        <select className="ss-select" style={{ maxWidth: 280 }} value={Array.isArray(klass.teachers) && klass.teachers[0] ? String(typeof klass.teachers[0] === 'object' ? klass.teachers[0].id : klass.teachers[0]) : ''} onChange={(e) => setTeacher(e.target.value)}>
          <option value="">No teacher</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.email}</option>)}
        </select>
      </div>

      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Roster · {roster.length}</p>
        {roster.length === 0 && <p className="ss-emptyline">No students enrolled.</p>}
        {roster.map((e) => {
          const s = e.student || {}
          return (
            <div key={e.id} className="ss-row">
              <span className="ss-row__name">{s.fullName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()}</span>
              <select className="ss-select" style={{ maxWidth: 170 }} defaultValue="" onChange={(ev) => move(e.id, ev.target.value)}>
                <option value="">Move to…</option>
                {allClasses.filter((c) => String(c.id) !== String(classId)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => withdraw(e.id)}>Withdraw</button>
            </div>
          )
        })}
        {unplaced.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="ss-eyebrow" style={{ margin: 0 }}>Enroll a student</span>
            <select className="ss-select" style={{ maxWidth: 240 }} defaultValue="" onChange={(e) => { if (e.target.value) enroll(e.target.value) }}>
              <option value="">Choose…</option>
              {unplaced.map((s) => <option key={s.id} value={s.id}>{s.fullName ?? `${s.firstName} ${s.lastName}`}</option>)}
            </select>
          </div>
        )}
      </div>
```

- [ ] **Step 4: Typecheck + commit**

Run `npx tsc --noEmit` (clean) and `npm test` (all pass). Boot dev; on a class detail page confirm roster moves/withdraw/enroll and teacher assignment work end-to-end.
```bash
git add src/admin/school/classes/ClassDetailClient.tsx
git commit -m "feat(school): class detail — roster + teacher management"
```

---

## Task 9: importMap + full verification

**Files:**
- Modify: `src/app/(payload)/admin/importMap.js` (regenerated if needed)

- [ ] **Step 1: Regenerate importMap**

Run: `npx payload generate:importmap`. Confirm `git diff` shows it current (the existing `SundaySchoolNav` entry stays). Commit only if changed.

- [ ] **Step 2: Full typecheck + suite + build**

Run `npx tsc --noEmit` → 0 errors. `npm test` → all pass. `npm run build` → exit 0; confirm `/admin/sunday-school`, `/admin/sunday-school/classes`, and `/admin/sunday-school/classes/[id]` appear in the route table with no errors.

- [ ] **Step 3: Manual verification**

`npm run dev`. As `admin`/`school_admin`: Dashboard shows the masthead, KPIs, and four charts (or friendly empty states with no data). Classes tab lists live classes; opening one lets you edit, archive (history present → delete disabled with explanation), assign a teacher, move/withdraw/enroll students, and cancel/reactivate sessions. As a `teacher`: the dashboard shows only their classes + Take Attendance, and visiting `/classes` redirects to the dashboard.

- [ ] **Step 4: Commit (if importMap changed)**

```bash
git add "src/app/(payload)/admin/importMap.js"
git commit -m "chore(school): regenerate importMap for management views"
```

---

## Self-Review

**Spec coverage (Phase 1):**
- Tab bar (Dashboard·Classes·Students·Attendance·Setup) → Task 4 (`SchoolTabs`). ✔
- Class `status` for archiving + migration → Task 1. ✔
- Analytics Dashboard: KPIs + 4 charts + needs-attention → Tasks 3, 5 (+ pure fns Task 2). ✔
- Teacher trimmed dashboard + management gated to 3 admin roles → Task 5 (+ route gates Tasks 6–7). ✔
- Classes list (live classes, show archived) → Task 6. ✔
- Class detail: edit, archive/restore, delete-only-without-history, sessions cancel/reactivate → Task 7. ✔
- Class detail: roster (enroll/move/withdraw) + teacher assign → Task 8. ✔
- Pure tested report functions → Task 2. ✔
- Charts are dependency-free SVG → Task 3. ✔
- Students/Attendance tabs render **disabled ("soon")** in Phase 1 (Task 4) — no dead links; the flag is dropped when those routes ship in Phase 2.

**Placeholder scan:** none — every code step is complete. The only deferred work is explicitly Phase 2 (Students/Attendance pages), whose tabs ship disabled.

**Type consistency:** `school-reports.ts` exports (`attendanceTrend/rateByClass/statusBreakdown/enrollmentByClass/dashboardKpis/canHardDelete` + types `Kpis/TrendPoint/ClassRate/ClassCount/Status`) are defined in Task 2 and consumed with matching names in Tasks 5 & 7. `DashboardData` defined in Task 5 and exported for the route. `toId`/`api` signatures unchanged. Chart prop interfaces (`DonutSeg/BarRow/TrendDatum`) defined in Task 3 and used in Task 5.

**Students/Attendance tabs:** rendered disabled (`soon: true`) in Task 4, so Phase 1 ships no dead links. Phase 2 drops the flag and adds the routes.
