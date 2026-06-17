import type { CollectionAfterChangeHook } from 'payload'

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

const day = (d: unknown): string => String(d ?? '').slice(0, 10)

/** Normalize a term's `holidays` array (of `{ date }`) to a set of YYYY-MM-DD strings. */
export function holidaySet(holidays?: Array<{ date?: unknown }> | null): Set<string> {
  return new Set((holidays ?? []).map((h) => day(h?.date)).filter(Boolean))
}

/**
 * All YYYY-MM-DD dates on `weekday` between start and end (inclusive),
 * excluding any date in `holidays`. UTC-based to avoid TZ drift.
 */
export function weeklyDates(start: string, end: string, weekday: string, holidays?: Iterable<string>): string[] {
  const target = WEEKDAY_INDEX[weekday] ?? 0
  const skip = holidays instanceof Set ? holidays : new Set(holidays ?? [])
  const out: string[] = []
  const cursor = new Date(`${start.slice(0, 10)}T00:00:00Z`)
  const last = new Date(`${end.slice(0, 10)}T00:00:00Z`)
  // advance cursor to the first matching weekday
  while (cursor.getUTCDay() !== target && cursor <= last) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  while (cursor <= last) {
    const iso = cursor.toISOString().slice(0, 10)
    if (!skip.has(iso)) out.push(iso)
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return out
}

export interface ExistingSession {
  id: string | number
  date: string
  hasAttendance: boolean
}

export interface SessionPlan {
  toCreate: string[]
  toCancel: (string | number)[]
  toDelete: (string | number)[]
}

/**
 * Reconcile a class's sessions against the desired meeting dates. Dates that
 * are no longer wanted (a newly-added holiday, or a shortened term) are
 * cancelled when they already hold attendance — preserving history — and
 * deleted otherwise. Pure; no I/O.
 */
export function reconcileSessions(desired: string[], existing: ExistingSession[]): SessionPlan {
  const desiredSet = new Set(desired)
  const existingDates = new Set(existing.map((e) => day(e.date)))
  const toCreate = desired.filter((d) => !existingDates.has(d))
  const obsolete = existing.filter((e) => !desiredSet.has(day(e.date)))
  return {
    toCreate,
    toCancel: obsolete.filter((e) => e.hasAttendance).map((e) => e.id),
    toDelete: obsolete.filter((e) => !e.hasAttendance).map((e) => e.id),
  }
}

/** On class create, materialise weekly ClassSessions across the term (skipping holidays). */
export const generateClassSessions: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const termId = typeof doc.term === 'object' ? doc.term?.id : doc.term
  if (!termId) return doc

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const term = await (req.payload as any).findByID({
    collection: 'terms',
    id: termId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (!term?.startDate || !term?.endDate) return doc

  const dates = weeklyDates(term.startDate, term.endDate, term.meetingDay ?? 'sunday', holidaySet(term.holidays))
  for (const date of dates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (req.payload as any).create({
        collection: 'class-sessions',
        data: { tenant: doc.tenant, class: doc.id, date, status: 'scheduled' },
        overrideAccess: true,
        req,
      })
    } catch {
      // unique (tenant, class, date) — ignore duplicates so the hook is idempotent
    }
  }
  return doc
}
