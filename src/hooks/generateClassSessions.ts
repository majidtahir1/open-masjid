import type { CollectionAfterChangeHook } from 'payload'

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

/** All YYYY-MM-DD dates on `weekday` between start and end (inclusive). UTC-based to avoid TZ drift. */
export function weeklyDates(start: string, end: string, weekday: string): string[] {
  const target = WEEKDAY_INDEX[weekday] ?? 0
  const out: string[] = []
  const cursor = new Date(`${start.slice(0, 10)}T00:00:00Z`)
  const last = new Date(`${end.slice(0, 10)}T00:00:00Z`)
  // advance cursor to the first matching weekday
  while (cursor.getUTCDay() !== target && cursor <= last) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return out
}

/** On class create, materialise weekly ClassSessions across the term. Idempotent per (tenant, class, date). */
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

  const dates = weeklyDates(term.startDate, term.endDate, term.meetingDay ?? 'sunday')
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
