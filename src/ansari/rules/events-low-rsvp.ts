// src/ansari/rules/events-low-rsvp.ts
import { addDays, localDateISO } from '@/ansari/time'
import type { Finding, Rule } from '@/ansari/types'

const LEAD_DAYS = 3
const LOW_RATIO = 0.25
const LOW_ABSOLUTE = 10 // uncapped forms

function extractId(rel: unknown): string | number | null {
  if (rel == null) return null
  if (typeof rel === 'object' && 'id' in rel) return (rel as { id: string | number }).id
  return rel as string | number
}

export const eventsLowRsvp: Rule = {
  id: 'events.low_rsvp',
  category: 'events',
  tier: 'digest',
  requiredScope: 'announcements:write',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const events = await payload.find({
      collection: 'events',
      where: {
        tenant: { equals: tenant.id },
        _status: { equals: 'published' },
        startDate: { greater_than: now.toISOString(), less_than_equal: addDays(now, LEAD_DAYS).toISOString() },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const findings: Finding[] = []
    for (const doc of events.docs as Array<{
      id: string | number
      title?: string
      startDate?: string
      signupForm?: unknown
    }>) {
      const formId = extractId(doc.signupForm)
      if (!formId) continue // no path from event → RSVP count without the link

      let capacity: number | null = null
      try {
        const form = (await payload.findByID({
          collection: 'forms',
          id: formId,
          depth: 0,
          overrideAccess: true,
        })) as { tenant?: unknown; settings?: { capacity?: number | null } }

        // Guard: cross-tenant form link — skip silently (Payload doesn't validate
        // relationship values by access; a REST write could point signupForm at
        // another tenant's form, and we read counts with overrideAccess).
        const formTenant = extractId((form as { tenant?: unknown }).tenant)
        if (formTenant != null && String(formTenant) !== String(tenant.id)) continue

        capacity = form.settings?.capacity ?? null
      } catch {
        continue
      }

      const { totalDocs: count } = await payload.count({
        collection: 'form-submissions',
        where: { and: [{ form: { equals: formId } }, { paymentStatus: { not_in: ['expired'] } }] },
        overrideAccess: true,
      })

      const low = capacity && capacity > 0 ? count < capacity * LOW_RATIO : count < LOW_ABSOLUTE
      if (!low) continue

      findings.push({
        dedupKey: `rsvp:${doc.id}`,
        intent: {
          rule: 'events.low_rsvp',
          eventId: doc.id,
          title: doc.title ?? '',
          startDate: doc.startDate ?? null,
          rsvpCount: count,
          capacity,
        },
        action: {
          kind: 'direct',
          op: 'postReminderAnnouncement',
          params: { eventId: doc.id },
          summary: `Post a reminder announcement for "${doc.title ?? 'the event'}"`,
        },
      })
    }
    return findings
  },

  // Non-idempotent direct action: creates a doc. The apply handler marks state
  // terminal before returning, so a second tap never reaches execute again.
  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('events.low_rsvp action must be direct')
    const { eventId } = finding.action.params as { eventId: string | number }
    const event = (await ctx.payload.findByID({
      collection: 'events',
      id: eventId,
      depth: 0,
      overrideAccess: true,
    })) as { title?: string; startDate?: string; tenant?: unknown }
    const when = event.startDate
      ? ` — ${localDateISO(new Date(event.startDate), ctx.tenant.timezone)}`
      : ''
    await ctx.payload.create({
      collection: 'announcements',
      data: {
        tenant: (extractId(event.tenant) ?? ctx.tenant.id) as number,
        title: `Reminder: ${event.title ?? 'Upcoming event'}${when}`,
        _status: 'published',
        active: true,
        priority: 'normal',
        ...(event.startDate ? { expiresAt: event.startDate } : {}),
      },
      overrideAccess: true,
    })
    return { ok: true, detail: 'Reminder announcement posted' }
  },
}
