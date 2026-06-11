// src/ansari/rules/events-missing-flyer.ts
import { addDays } from '@/ansari/time'
import type { Finding, Rule } from '@/ansari/types'

const LEAD_DAYS = 7

export const eventsMissingFlyer: Rule = {
  id: 'events.missing_flyer',
  category: 'events',
  tier: 'digest',
  requiredScope: 'events:write',

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
      flyerImage?: unknown
    }>) {
      if (doc.flyerImage) continue
      findings.push({
        dedupKey: `flyer:${doc.id}`,
        intent: {
          rule: 'events.missing_flyer',
          eventId: doc.id,
          title: doc.title ?? '',
          startDate: doc.startDate ?? null,
        },
        action: {
          kind: 'conversation-starter',
          topic: 'generate-flyer',
          summary: `Generate a flyer for "${doc.title ?? 'the event'}"`,
        },
      })
    }
    return findings
  },
}
