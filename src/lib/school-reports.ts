const idOf = (v: unknown): string | number =>
  typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string | number }).id : (v as string | number)
const day = (d: unknown) => String(d ?? '').slice(0, 10)

export type Status = 'present' | 'absent' | 'late' | 'excused'
export interface SessionDoc { id: string | number; class: unknown; date: string }
export interface RecordDoc { session: unknown; status: string }
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
  for (const r of records) if (r.status in out) out[r.status as Status] += 1
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
