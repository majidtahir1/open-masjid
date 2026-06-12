// src/ansari/rules/forms-capacity.ts
import type { Finding, Rule } from '@/ansari/types'

const NEAR_RATIO = 0.9
const RAISE_RATIO = 1.25

export const formsCapacity: Rule = {
  id: 'forms.capacity',
  category: 'forms',
  tier: 'immediate',
  requiredScope: 'forms:write',

  async evaluate(ctx) {
    const { payload, tenant } = ctx
    const forms = await payload.find({
      collection: 'forms',
      where: { tenant: { equals: tenant.id }, status: { equals: 'published' } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })

    const findings: Finding[] = []
    for (const doc of forms.docs as Array<{
      id: string | number
      title?: string
      settings?: { capacity?: number | null }
    }>) {
      const capacity = doc.settings?.capacity
      if (!capacity || capacity <= 0) continue

      const { totalDocs: count } = await payload.count({
        collection: 'form-submissions',
        where: { and: [{ form: { equals: doc.id } }, { paymentStatus: { not_in: ['expired'] } }] },
        overrideAccess: true,
      })

      const base = {
        rule: 'forms.capacity',
        formId: doc.id,
        title: doc.title ?? '',
        capacity,
        submissionCount: count,
      }
      if (count >= capacity) {
        findings.push({
          dedupKey: `formcap:${doc.id}:full`,
          intent: { ...base, level: 'full' },
          action: {
            kind: 'direct',
            op: 'closeForm',
            params: { formId: doc.id },
            summary: `Close "${doc.title ?? 'the form'}" — it is full`,
          },
        })
      } else if (count >= Math.ceil(capacity * NEAR_RATIO)) {
        const newCapacity = Math.ceil(capacity * RAISE_RATIO)
        findings.push({
          dedupKey: `formcap:${doc.id}:near`,
          intent: { ...base, level: 'near' },
          action: {
            kind: 'direct',
            op: 'raiseFormCapacity',
            params: { formId: doc.id, newCapacity },
            summary: `Raise "${doc.title ?? 'the form'}" capacity to ${newCapacity}`,
          },
        })
      }
    }
    return findings
  },

  async execute(ctx, finding) {
    if (finding.action.kind !== 'direct') throw new Error('forms.capacity action must be direct')
    const { op, params } = finding.action
    if (op === 'closeForm') {
      const { formId } = params as { formId: string | number }
      await ctx.payload.update({
        collection: 'forms',
        id: formId,
        data: { status: 'closed' },
        overrideAccess: true,
      })
      return { ok: true, detail: 'Form closed' }
    }
    if (op === 'raiseFormCapacity') {
      const { formId, newCapacity } = params as { formId: string | number; newCapacity: number }
      const doc = (await ctx.payload.findByID({
        collection: 'forms',
        id: formId,
        depth: 0,
        overrideAccess: true,
      })) as { settings?: Record<string, unknown> }
      await ctx.payload.update({
        collection: 'forms',
        id: formId,
        data: { settings: { ...(doc.settings ?? {}), capacity: newCapacity } },
        overrideAccess: true,
      })
      return { ok: true, detail: `Capacity raised to ${newCapacity}` }
    }
    throw new Error(`Unknown forms.capacity op: ${op}`)
  },
}
