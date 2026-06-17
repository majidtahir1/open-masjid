const WEEK_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_PLURAL: Record<string, string> = {
  sunday: 'Sundays', monday: 'Mondays', tuesday: 'Tuesdays', wednesday: 'Wednesdays',
  thursday: 'Thursdays', friday: 'Fridays', saturday: 'Saturdays',
}

/** Human label for a set of meeting days, e.g. "Saturdays & Sundays", "Weekdays", "Every day". */
export function formatDays(days: string[]): string {
  const set = new Set(days)
  if (set.size === 0) return '—'
  if (set.size === 7) return 'Every day'
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  if (set.size === 5 && weekdays.every((d) => set.has(d))) return 'Weekdays'
  const ordered = WEEK_ORDER.filter((d) => set.has(d)).map((d) => DAY_PLURAL[d])
  if (ordered.length === 1) return ordered[0]
  return `${ordered.slice(0, -1).join(', ')} & ${ordered[ordered.length - 1]}`
}

export interface HubTerm {
  id: string | number
  name: string
  startDate?: string | null
  endDate?: string | null
  meetingDay?: string | null
  holidays: string[]
  sessionsPerClass: number
}

export interface HubSummary {
  term: HubTerm | null
  classCount: number
  teacherlessCount: number
  placedCount: number
  unplacedCount: number
}

const idOf = (v: unknown): string | number =>
  typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

/**
 * Which wizard step to resume at. Never returns 3 (Teachers) — that step is
 * skippable, so it must never block resume. Returns 5 when setup is complete.
 */
export function firstIncompleteStep(s: HubSummary): 1 | 2 | 4 | 5 {
  if (!s.term) return 1
  if (s.classCount === 0) return 2
  if (s.unplacedCount > 0) return 4
  return 5
}

interface RawDocs {
  term: {
    id: string | number
    name: string
    startDate?: string | null
    endDate?: string | null
    meetingDay?: string | null
    holidays?: Array<{ date?: unknown }> | null
  } | null
  classes: Array<{ id: string | number; teachers?: unknown[] }>
  enrollments: Array<{ student: unknown; status?: string }>
  students: Array<{ id: string | number }>
  sessionsPerClass: number
}

/** Pure aggregation of raw docs into the hub summary. */
export function buildHubSummary(raw: RawDocs): HubSummary {
  if (!raw.term) {
    return { term: null, classCount: 0, teacherlessCount: 0, placedCount: 0, unplacedCount: 0 }
  }
  const teacherlessCount = raw.classes.filter((c) => !c.teachers || c.teachers.length === 0).length
  const placedIds = new Set(
    raw.enrollments.filter((e) => e.status === 'active').map((e) => String(idOf(e.student))),
  )
  const placedCount = placedIds.size
  const unplacedCount = raw.students.filter((st) => !placedIds.has(String(st.id))).length
  return {
    term: {
      id: raw.term.id,
      name: raw.term.name,
      startDate: raw.term.startDate ?? null,
      endDate: raw.term.endDate ?? null,
      meetingDay: raw.term.meetingDay ?? null,
      holidays: (raw.term.holidays ?? []).map((h) => String(h?.date ?? '').slice(0, 10)).filter(Boolean),
      sessionsPerClass: raw.sessionsPerClass,
    },
    classCount: raw.classes.length,
    teacherlessCount,
    placedCount,
    unplacedCount,
  }
}
