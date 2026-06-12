import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  ansariNudgeApplyEndpoint,
  ansariNudgeDismissEndpoint,
  ansariNudgeMuteEndpoint,
  ansariNudgeSnoozeEndpoint,
} from '@/endpoints/ansari/nudgeActions'

// The apply handler builds its NudgeContext from the real clock — pin it so
// the coverage-gap fixtures below evaluate deterministically forever.
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-06-11T17:00:00Z'))
})
afterAll(() => vi.useRealTimers())

const FIRING_SCHEDULE = { docs: [{ id: 42, endDate: '2026-06-15T00:00:00.000Z' }], totalDocs: 1 }
// matches what prayer.coverage_gap produces for the firing schedule on 2026-06-11
const STORED_ACTION = {
  kind: 'direct',
  op: 'extendSchedule',
  params: { scheduleId: 42, newEndDate: '2026-07-31' },
  summary: 'Extend the prayer schedule through 2026-07-31',
}

function req(over: { state?: object | null; schedules?: object; scopes?: string[]; settings?: object[] } = {}) {
  const state =
    over.state === undefined
      ? { id: 55, tenant: 7, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate', action: STORED_ACTION, intent: {} }
      : over.state
  const payload = {
    findByID: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'nudge-states') {
        if (!state) throw Object.assign(new Error('NotFound'), { status: 404 })
        return state
      }
      if (collection === 'tenants') return { id: 7, location: { timezone: 'America/Chicago' } }
      return null
    }),
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'prayer-schedules') return over.schedules ?? FIRING_SCHEDULE
      if (collection === 'ansari-settings') return { docs: over.settings ?? [], totalDocs: 0 }
      return { docs: [], totalDocs: 0 }
    }),
    // update mock: when called with a `where` clause (claim), return { docs: [data] }
    // shape; otherwise return the data directly (legacy setStatus calls).
    update: vi.fn(async (a: { collection?: string; id?: unknown; where?: unknown; data: Record<string, unknown> }) => {
      if (a.where != null) return { docs: [a.data] }
      return a.data
    }),
    create: vi.fn(async (a: { data: object }) => ({ id: 2, ...a.data })),
    count: vi.fn(async () => ({ totalDocs: 0 })),
    logger: { error: vi.fn(), warn: vi.fn() },
  }
  return {
    raw: {
      user: { id: 1, role: 'admin', tenant: 7, _strategy: 'api-key', apiScopes: over.scopes ?? ['ansari:nudges', 'prayer-times:write'] },
      payload,
      routeParams: { id: '55' },
    } as never,
    payload,
  }
}

describe('POST /api/ansari/nudges/:id/apply', () => {
  it('re-validates and executes when the problem still fires with the same action', async () => {
    const { raw, payload } = req()
    const res = await ansariNudgeApplyEndpoint.handler(raw)
    const body = await res.json()
    expect(body.status).toBe('applied')
    // executed the schedule extension…
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'prayer-schedules', id: 42 }),
    )
    // …and claimed+marked the state applied
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'nudge-states', data: expect.objectContaining({ status: 'applied' }) }),
    )
  })

  it('claim happens BEFORE execute (prayer-schedules update)', async () => {
    const { raw, payload } = req()
    await ansariNudgeApplyEndpoint.handler(raw)
    const calls = payload.update.mock.calls as Array<[{ collection?: string; where?: unknown }]>
    // Find the indices of the claim call (where-based) and the execute call
    const claimIdx = calls.findIndex(
      (c) => c[0].collection === 'nudge-states' && c[0].where != null,
    )
    const execIdx = calls.findIndex(
      (c) => c[0].collection === 'prayer-schedules',
    )
    expect(claimIdx).toBeGreaterThanOrEqual(0)
    expect(execIdx).toBeGreaterThanOrEqual(0)
    expect(claimIdx).toBeLessThan(execIdx)
  })

  it('answers already-handled when the problem no longer fires (and resolves the state)', async () => {
    const { raw, payload } = req({ schedules: { docs: [{ id: 42, endDate: '2026-09-15T00:00:00.000Z' }], totalDocs: 1 } })
    const body = await (await ansariNudgeApplyEndpoint.handler(raw)).json()
    expect(body.status).toBe('already-handled')
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'nudge-states', data: expect.objectContaining({ status: 'resolved' }) }),
    )
  })

  it('answers already-handled for a missing state (stale Telegram button, never a 404)', async () => {
    const { raw } = req({ state: null })
    const body = await (await ansariNudgeApplyEndpoint.handler(raw)).json()
    expect(body.status).toBe('already-handled')
  })

  it('returns changed (and does NOT execute) when the fresh action differs', async () => {
    // Same dedupKey still fires, but the stored proposal is stale (data moved
    // since the nudge): fresh evaluate proposes 2026-07-31, stored says 2026-06-30.
    const { raw, payload } = req({
      state: {
        id: 55,
        tenant: 7,
        rule: 'prayer.coverage_gap',
        dedupKey: 'coverage:2026-06',
        status: 'delivered',
        tier: 'immediate',
        intent: {},
        action: {
          ...STORED_ACTION,
          params: { scheduleId: 42, newEndDate: '2026-06-30' },
          summary: 'Extend the prayer schedule through 2026-06-30',
        },
      },
    })
    const body = await (await ansariNudgeApplyEndpoint.handler(raw)).json()
    expect(body.status).toBe('changed')
    expect(body.nudge.action.params.newEndDate).toBe('2026-07-31') // fresh proposal included
    expect(payload.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'prayer-schedules' }),
    )
    // state re-armed with the fresh proposal
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'nudge-states',
        data: expect.objectContaining({ status: 'emitted' }),
      }),
    )
  })

  it('returns applied (not changed) when stored action has same content but reordered keys (jsonb round-trip)', async () => {
    // Simulate jsonb reordering: keys come back in a different order than STORED_ACTION
    const reorderedAction = {
      summary: STORED_ACTION.summary,
      params: { newEndDate: STORED_ACTION.params.newEndDate, scheduleId: STORED_ACTION.params.scheduleId },
      op: STORED_ACTION.op,
      kind: STORED_ACTION.kind,
    }
    const { raw } = req({
      state: {
        id: 55,
        tenant: 7,
        rule: 'prayer.coverage_gap',
        dedupKey: 'coverage:2026-06',
        status: 'delivered',
        tier: 'immediate',
        intent: {},
        action: reorderedAction,
      },
    })
    const body = await (await ansariNudgeApplyEndpoint.handler(raw)).json()
    // canonical comparison must treat both as equal → applied, not changed
    expect(body.status).toBe('applied')
  })

  it('403s an API key lacking the rule requiredScope', async () => {
    const { raw } = req({ scopes: ['ansari:nudges'] }) // no prayer-times:write
    expect((await ansariNudgeApplyEndpoint.handler(raw)).status).toBe(403)
  })

  it('returns 500 with body.status error when evaluate throws, and does NOT update state to applied', async () => {
    const { raw, payload } = req()
    // Make prayer-schedules throw so rule.evaluate fails
    payload.find = vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'prayer-schedules') throw new Error('DB connection failed')
      if (collection === 'ansari-settings') return { docs: [], totalDocs: 0 }
      return { docs: [], totalDocs: 0 }
    })
    const res = await ansariNudgeApplyEndpoint.handler(raw)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.status).toBe('error')
    // State must NOT have been claimed/set to applied
    expect(payload.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'nudge-states', data: expect.objectContaining({ status: 'applied' }) }),
    )
  })

  it('answers already-handled (not 404) for a state belonging to another tenant (existence oracle)', async () => {
    const foreignState = { id: 55, tenant: 999, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered', tier: 'immediate', action: STORED_ACTION, intent: {} }
    const { raw, payload } = req({ state: foreignState })
    const res = await ansariNudgeApplyEndpoint.handler(raw)
    const body = await res.json()
    expect(body.status).toBe('already-handled')
    // no updates must happen
    expect(payload.update).not.toHaveBeenCalled()
  })
})

describe('dismiss / snooze / mute', () => {
  it('dismiss marks the state dismissed', async () => {
    const { raw, payload } = req()
    await ansariNudgeDismissEndpoint.handler(raw)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'nudge-states', data: expect.objectContaining({ status: 'dismissed' }) }),
    )
  })

  it('snooze marks the state snoozed with a timestamp', async () => {
    const { raw, payload } = req()
    await ansariNudgeSnoozeEndpoint.handler(raw)
    const call = payload.update.mock.calls.find((c) => c[0].collection === 'nudge-states')![0]
    expect(call.data.status).toBe('snoozed')
    expect(call.data.snoozedAt).toBeTruthy()
  })

  it('mute adds the rule to disabledRules (creating settings when absent) and dismisses', async () => {
    const { raw, payload } = req({ settings: [] })
    const body = await (await ansariNudgeMuteEndpoint.handler(raw)).json()
    expect(body.ok).toBe(true)
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'ansari-settings',
        data: expect.objectContaining({ tenant: 7, disabledRules: ['prayer.coverage_gap'] }),
      }),
    )
  })

  it('mute merges into existing settings without duplicates', async () => {
    const { raw, payload } = req({ settings: [{ id: 3, disabledRules: ['prayer.coverage_gap'] }] })
    await ansariNudgeMuteEndpoint.handler(raw)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'ansari-settings',
        id: 3,
        data: { disabledRules: ['prayer.coverage_gap'] },
      }),
    )
  })

  it('mute stamps resolvedAt on all open states for that rule (sweep-stamp)', async () => {
    // Arrange: two open nudge-states for prayer.coverage_gap
    const openStatesForRule = [
      { id: 55, tenant: 7, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-06', status: 'delivered' },
      { id: 56, tenant: 7, rule: 'prayer.coverage_gap', dedupKey: 'coverage:2026-05', status: 'snoozed' },
    ]
    const { raw, payload } = req({ settings: [] })
    // Override find so the nudge-states query for rule+tenant returns our fixtures
    payload.find = vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
      if (collection === 'ansari-settings') return { docs: [], totalDocs: 0 }
      if (collection === 'nudge-states') {
        // The mute handler queries nudge-states by tenant + rule
        const ruleFilter = (where as { rule?: { equals?: string } })?.rule?.equals
        if (ruleFilter === 'prayer.coverage_gap') return { docs: openStatesForRule, totalDocs: 2 }
        return { docs: [], totalDocs: 0 }
      }
      return { docs: [], totalDocs: 0 }
    })
    await ansariNudgeMuteEndpoint.handler(raw)
    // Both open states must have received a resolvedAt stamp
    const resolvedCalls = (payload.update.mock.calls as Array<[{ collection?: string; id?: unknown; data: Record<string, unknown> }]>).filter(
      (c) => c[0].collection === 'nudge-states' && c[0].data.resolvedAt != null && c[0].id != null,
    )
    const resolvedIds = resolvedCalls.map((c) => c[0].id)
    expect(resolvedIds).toContain(55)
    expect(resolvedIds).toContain(56)
  })
})
