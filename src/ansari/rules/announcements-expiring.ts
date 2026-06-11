// src/ansari/rules/announcements-expiring.ts
import { addDays } from '@/ansari/time'
import type { Finding, Rule } from '@/ansari/types'

const EXTEND_DAYS = 7

export const announcementsExpiring: Rule = {
  id: 'announcements.expiring',
  category: 'announcements',
  tier: 'immediate',
  requiredScope: 'announcements:write',

  async evaluate(ctx) {
    const { payload, tenant, now } = ctx
    const res = await payload.find({
      collection: 'announcements',
      where: {
        tenant: { equals: tenant.id },
        active: { equals: true },
        expiresAt: { greater_than: now.toISOString(), less_than_equal: addDays(now, 1).toISOString() },
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })

    const findings: Finding[] = []
    for (const doc of res.docs as Array<{ id: string | number; title?: string; expiresAt?: string }>) {
      if (!doc.expiresAt) continue
      const newExpiresAt = addDays(new Date(doc.expiresAt), EXTEND_DAYS).toISOString()
      findings.push({
        dedupKey: `ann:${doc.id}:${doc.expiresAt}`,
        intent: {
          rule: 'announcements.expiring',
          announcementId: doc.id,
          title: doc.title ?? '',
          expiresAt: doc.expiresAt,
        },
        action: {
          kind: 'direct',
          op: 'extendAnnouncement',
          params: { announcementId: doc.id, newExpiresAt },
          summary: `Keep "${doc.title ?? 'the announcement'}" up for another week`,
        },
      })
    }
    return findings
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('announcements.expiring action must be direct')
    const { announcementId, newExpiresAt } = finding.action.params as {
      announcementId: string | number
      newExpiresAt: string
    }
    await ctx.payload.update({
      collection: 'announcements',
      id: announcementId,
      data: { expiresAt: newExpiresAt },
      overrideAccess: true,
    })
    return { ok: true, detail: `Extended through ${newExpiresAt.slice(0, 10)}` }
  },
}
