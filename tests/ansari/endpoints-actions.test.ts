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
        if (!state) throw new Error('NotFound')
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
    update: vi.fn(async (a: { collection?: string; id?: unknown; data: Record<string, unknown> }) => a.data),
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
    // …and marked the state applied
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'nudge-states', data: expect.objectContaining({ status: 'applied' }) }),
    )
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

  it('403s an API key lacking the rule requiredScope', async () => {
    const { raw } = req({ scopes: ['ansari:nudges'] }) // no prayer-times:write
    expect((await ansariNudgeApplyEndpoint.handler(raw)).status).toBe(403)
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
})
