// tests/ansari/digest-weekly.test.ts
import { describe, expect, it, vi } from 'vitest'

import { RULES, ruleById } from '@/ansari/registry'
import { digestWeekly } from '@/ansari/rules/digest-weekly'
import { RULE_IDS } from '@/ansari/ruleIds'
import { makeCtx, makePayload } from './helpers'

describe('digest.weekly', () => {
  it('rolls up member stats, upcoming events, and unresolved immediates', async () => {
    const payload = makePayload({
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'events') {
          return {
            docs: [{ id: 1, title: 'Halaqa', startDate: '2026-06-15T00:00:00.000Z', flyerImage: null }],
            totalDocs: 1,
          }
        }
        if (collection === 'nudge-states') {
          return {
            docs: [{ id: 50, rule: 'prayer.coverage_gap', status: 'delivered', intent: { rule: 'prayer.coverage_gap' } }],
            totalDocs: 1,
          }
        }
        return { docs: [], totalDocs: 0 }
      }),
      count: vi.fn(async ({ where }: { where?: Record<string, unknown> }) => {
        // member count: total=120, new-this-month=4 (keyed by presence of createdAt filter)
        const isNewQuery = JSON.stringify(where).includes('createdAt')
        return { totalDocs: isNewQuery ? 4 : 120 }
      }),
    })
    const findings = await digestWeekly.evaluate(makeCtx(payload)) // 2026-06-11 → ISO week 24
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('digest:2026-W24')
    expect(findings[0].intent).toMatchObject({
      stats: { membersTotal: 120, membersNewThisMonth: 4 },
    })
    expect((findings[0].intent.upcomingEvents as unknown[]).length).toBe(1)
    expect((findings[0].intent.unresolved as unknown[]).length).toBe(1)
    expect(findings[0].action.kind).toBe('conversation-starter')
  })

  it('queries only published events', async () => {
    const payload = makePayload()
    await digestWeekly.evaluate(makeCtx(payload))
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'events',
        where: expect.objectContaining({ _status: { equals: 'published' } }),
      }),
    )
  })

  it('safety net spans both tiers, excludes its own state and resolved-stamped rows', async () => {
    const payload = makePayload()
    await digestWeekly.evaluate(makeCtx(payload))
    const call = payload.find.mock.calls.find(
      (c: Array<{ collection?: string }>) => c[0].collection === 'nudge-states',
    )![0] as { where: Record<string, unknown> }
    expect(call.where).toMatchObject({
      rule: { not_equals: 'digest.weekly' },
      status: { in: ['emitted', 'delivered', 'snoozed'] },
      resolvedAt: { exists: false },
    })
    expect(call.where).not.toHaveProperty('tier') // digest-tier snoozed items resurface too
  })
})

describe('registry', () => {
  it('contains every rule id exactly once', () => {
    expect(RULES.map((r) => r.id).sort()).toEqual([...RULE_IDS].sort())
    expect(ruleById('prayer.coverage_gap')?.tier).toBe('immediate')
    expect(ruleById('nope')).toBeUndefined()
  })

  it('direct-action rules all have execute()', () => {
    for (const id of ['prayer.coverage_gap', 'prayer.iqamah_drift', 'forms.capacity', 'announcements.expiring', 'events.low_rsvp']) {
      expect(ruleById(id)?.execute, id).toBeTypeOf('function')
    }
  })
})
