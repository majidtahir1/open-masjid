// tests/ansari/events-rules.test.ts
import { describe, expect, it, vi } from 'vitest'

import { eventsLowRsvp } from '@/ansari/rules/events-low-rsvp'
import { eventsMissingFlyer } from '@/ansari/rules/events-missing-flyer'
import { makeCtx, makePayload } from './helpers'

const NOW = '2026-06-11T17:00:00Z'

describe('events.low_rsvp', () => {
  function payloadFor(events: object[], formCapacity: number | null, submissions: number) {
    return makePayload({
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'events') return { docs: events, totalDocs: events.length }
        if (collection === 'form-submissions') return { docs: [], totalDocs: submissions }
        return { docs: [], totalDocs: 0 }
      }),
      findByID: vi.fn(async () => ({ id: 30, settings: { capacity: formCapacity } })),
    })
  }
  const event = (signupForm: number | null) => ({
    id: 11,
    title: 'Eid Dinner',
    startDate: '2026-06-13T23:00:00.000Z', // ~2 days out
    tenant: 7,
    signupForm,
  })

  it('fires when RSVPs are under 25% of the linked form capacity', async () => {
    const payload = payloadFor([event(30)], 100, 20)
    const findings = await eventsLowRsvp.evaluate(makeCtx(payload, { now: NOW }))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('rsvp:11')
    expect(findings[0].intent).toMatchObject({ rsvpCount: 20, capacity: 100 })
    expect(findings[0].action).toMatchObject({ kind: 'direct', op: 'postReminderAnnouncement' })
  })

  it('uses the <10 fallback when the form has no capacity', async () => {
    expect(await eventsLowRsvp.evaluate(makeCtx(payloadFor([event(30)], null, 9), { now: NOW }))).toHaveLength(1)
    expect(await eventsLowRsvp.evaluate(makeCtx(payloadFor([event(30)], null, 12), { now: NOW }))).toEqual([])
  })

  it('skips events without a linked signup form', async () => {
    expect(await eventsLowRsvp.evaluate(makeCtx(payloadFor([event(null)], 100, 0), { now: NOW }))).toEqual([])
  })

  it('skips events whose linked form belongs to a different tenant', async () => {
    const payload = makePayload({
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'events') return { docs: [event(30)], totalDocs: 1 }
        if (collection === 'form-submissions') return { docs: [], totalDocs: 0 }
        return { docs: [], totalDocs: 0 }
      }),
      // findByID returns a form that belongs to tenant 999, not tenant 7
      findByID: vi.fn(async () => ({ id: 30, tenant: 999, settings: { capacity: 100 } })),
    })
    expect(await eventsLowRsvp.evaluate(makeCtx(payload, { now: NOW }))).toEqual([])
  })

  it('execute posts a reminder announcement expiring at the event start', async () => {
    const payload = makePayload({
      findByID: vi.fn(async () => ({ id: 11, title: 'Eid Dinner', startDate: '2026-06-13T23:00:00.000Z', tenant: 7 })),
    })
    await eventsLowRsvp.execute!(makeCtx(payload, { now: NOW }), {
      dedupKey: 'rsvp:11',
      intent: {},
      action: { kind: 'direct', op: 'postReminderAnnouncement', params: { eventId: 11 }, summary: '' },
    })
    const call = payload.create.mock.calls[0][0]
    expect(call.collection).toBe('announcements')
    expect(call.data).toMatchObject({ tenant: 7, active: true, expiresAt: '2026-06-13T23:00:00.000Z' })
    expect(call.data.title).toContain('Eid Dinner')
  })
})

describe('events.missing_flyer', () => {
  it('fires for events within 7 days that have no flyer image', async () => {
    const payload = makePayload({
      find: vi.fn(async () => ({
        docs: [
          { id: 21, title: 'Halaqa', startDate: '2026-06-15T00:00:00.000Z', flyerImage: null },
          { id: 22, title: 'Fundraiser', startDate: '2026-06-16T00:00:00.000Z', flyerImage: 99 },
        ],
        totalDocs: 2,
      })),
    })
    const findings = await eventsMissingFlyer.evaluate(makeCtx(payload, { now: NOW }))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe('flyer:21')
    expect(findings[0].action).toMatchObject({ kind: 'conversation-starter', topic: 'generate-flyer' })
  })
})
