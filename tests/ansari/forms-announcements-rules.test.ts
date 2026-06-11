// tests/ansari/forms-announcements-rules.test.ts
import { describe, expect, it, vi } from 'vitest'

import { announcementsExpiring } from '@/ansari/rules/announcements-expiring'
import { formsCapacity } from '@/ansari/rules/forms-capacity'
import { makeCtx, makePayload } from './helpers'

function formsPayload(forms: object[], countsByFormId: Record<number, number>) {
  return makePayload({
    find: vi.fn(async ({ collection, where }: { collection: string; where?: never }) => {
      if (collection === 'forms') return { docs: forms, totalDocs: forms.length }
      if (collection === 'form-submissions') {
        const formId = (where as { form?: { equals?: number } })?.form?.equals ?? -1
        return { docs: [], totalDocs: countsByFormId[formId] ?? 0 }
      }
      return { docs: [], totalDocs: 0 }
    }),
  })
}

describe('forms.capacity', () => {
  const form = (id: number, capacity: number | null) => ({
    id,
    title: `Form ${id}`,
    status: 'published',
    settings: { capacity },
  })

  it('fires "full" at 100% with a close action, "near" at 90% with a raise action', async () => {
    const payload = formsPayload([form(1, 100), form(2, 100), form(3, 100)], { 1: 100, 2: 92, 3: 50 })
    const findings = await formsCapacity.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(2)
    const full = findings.find((f) => f.dedupKey === 'formcap:1:full')!
    expect(full.action).toMatchObject({ kind: 'direct', op: 'closeForm', params: { formId: 1 } })
    const near = findings.find((f) => f.dedupKey === 'formcap:2:near')!
    expect(near.action).toMatchObject({
      kind: 'direct',
      op: 'raiseFormCapacity',
      params: { formId: 2, newCapacity: 125 },
    })
  })

  it('skips forms without a capacity', async () => {
    const payload = formsPayload([form(1, null)], { 1: 500 })
    expect(await formsCapacity.evaluate(makeCtx(payload))).toEqual([])
  })

  it('execute closes a form / raises capacity', async () => {
    const payload = makePayload({
      findByID: vi.fn(async () => ({ id: 2, settings: { capacity: 100, requiresPayment: false } })),
    })
    const ctx = makeCtx(payload)
    await formsCapacity.execute!(ctx, {
      dedupKey: 'formcap:1:full',
      intent: {},
      action: { kind: 'direct', op: 'closeForm', params: { formId: 1 }, summary: '' },
    })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'forms', id: 1, data: { status: 'closed' } }),
    )
    await formsCapacity.execute!(ctx, {
      dedupKey: 'formcap:2:near',
      intent: {},
      action: { kind: 'direct', op: 'raiseFormCapacity', params: { formId: 2, newCapacity: 125 }, summary: '' },
    })
    const raise = payload.update.mock.calls[1][0]
    expect(raise.data.settings).toMatchObject({ capacity: 125, requiresPayment: false }) // preserves siblings
  })
})

describe('announcements.expiring', () => {
  it('fires for active announcements expiring within 24h, keyed by id+expiry', async () => {
    const expiresAt = '2026-06-12T03:00:00.000Z' // 10h after fixture now
    const payload = makePayload({
      find: vi.fn(async () => ({
        docs: [{ id: 5, title: "Jumu'ah moved", expiresAt }],
        totalDocs: 1,
      })),
    })
    const findings = await announcementsExpiring.evaluate(makeCtx(payload))
    expect(findings).toHaveLength(1)
    expect(findings[0].dedupKey).toBe(`ann:5:${expiresAt}`)
    expect(findings[0].action).toMatchObject({
      kind: 'direct',
      op: 'extendAnnouncement',
      params: { announcementId: 5, newExpiresAt: '2026-06-19T03:00:00.000Z' },
    })
  })

  it('execute pushes the expiry out', async () => {
    const payload = makePayload()
    await announcementsExpiring.execute!(makeCtx(payload), {
      dedupKey: 'ann:5:x',
      intent: {},
      action: {
        kind: 'direct',
        op: 'extendAnnouncement',
        params: { announcementId: 5, newExpiresAt: '2026-06-19T03:00:00.000Z' },
        summary: '',
      },
    })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'announcements',
        id: 5,
        data: { expiresAt: '2026-06-19T03:00:00.000Z' },
      }),
    )
  })
})
