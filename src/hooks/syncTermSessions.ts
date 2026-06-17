import type { CollectionAfterChangeHook } from 'payload'
import { holidaySet, reconcileSessions, weeklyDates, type ExistingSession } from './generateClassSessions'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * When a term's schedule changes (dates, meeting day, or holidays), re-sync the
 * sessions of every class in that term: create newly-valid weekly dates, drop
 * dates that are now holidays or out of range. Sessions that already hold
 * attendance are cancelled rather than deleted, so history is never lost.
 */
export const syncTermSessions: CollectionAfterChangeHook = async ({ doc, operation, req, previousDoc }) => {
  if (operation !== 'update') return doc
  if (!doc?.startDate || !doc?.endDate) return doc

  // Only do the work when something that affects the schedule actually changed.
  const scheduleChanged =
    previousDoc?.startDate !== doc.startDate ||
    previousDoc?.endDate !== doc.endDate ||
    previousDoc?.meetingDay !== doc.meetingDay ||
    JSON.stringify(previousDoc?.holidays ?? []) !== JSON.stringify(doc.holidays ?? [])
  if (!scheduleChanged) return doc

  const payload = req.payload as any
  const desired = weeklyDates(doc.startDate, doc.endDate, doc.meetingDay ?? 'sunday', holidaySet(doc.holidays))

  const classes = await payload.find({
    collection: 'school-classes',
    where: { term: { equals: doc.id } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    req,
  })

  for (const klass of classes.docs as Array<{ id: string | number }>) {
    const sessionRes = await payload.find({
      collection: 'class-sessions',
      where: { class: { equals: klass.id } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const sessionDocs = sessionRes.docs as Array<{ id: string | number; date: string }>
    if (sessionDocs.length === 0 && desired.length === 0) continue

    // Which existing sessions already hold attendance?
    const ids = sessionDocs.map((s) => s.id)
    let withAttendance = new Set<string>()
    if (ids.length) {
      const att = await payload.find({
        collection: 'attendance-records',
        where: { session: { in: ids } },
        limit: 10000,
        depth: 0,
        overrideAccess: true,
        req,
      })
      withAttendance = new Set(
        (att.docs as Array<{ session: unknown }>).map((a) =>
          String(typeof a.session === 'object' && a.session ? (a.session as any).id : a.session),
        ),
      )
    }

    const existing: ExistingSession[] = sessionDocs.map((s) => ({
      id: s.id,
      date: s.date,
      hasAttendance: withAttendance.has(String(s.id)),
    }))

    const plan = reconcileSessions(desired, existing)

    for (const date of plan.toCreate) {
      try {
        await payload.create({
          collection: 'class-sessions',
          data: { tenant: doc.tenant, class: klass.id, date, status: 'scheduled' },
          overrideAccess: true,
          req,
        })
      } catch {
        /* unique (tenant, class, date) — ignore races */
      }
    }
    for (const id of plan.toCancel) {
      await payload.update({ collection: 'class-sessions', id, data: { status: 'cancelled' }, overrideAccess: true, req })
    }
    for (const id of plan.toDelete) {
      await payload.delete({ collection: 'class-sessions', id, overrideAccess: true, req })
    }
  }

  return doc
}
