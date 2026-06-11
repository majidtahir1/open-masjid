// tests/ansari/helpers.ts
import { vi } from 'vitest'

import type { NudgeContext } from '@/ansari/types'

export type PayloadMock = {
  find: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  count: ReturnType<typeof vi.fn>
}

export function makePayload(over: Partial<PayloadMock> = {}): PayloadMock {
  return {
    find: over.find ?? vi.fn(async () => ({ docs: [], totalDocs: 0 })),
    findByID: over.findByID ?? vi.fn(async () => null),
    update: over.update ?? vi.fn(async (a: { data: unknown }) => a.data),
    create: over.create ?? vi.fn(async (a: { data: object }) => ({ id: 1, ...a.data })),
    count: over.count ?? vi.fn(async () => ({ totalDocs: 0 })),
  }
}

export function makeCtx(
  payload: PayloadMock,
  opts: { now?: string; timezone?: string } = {},
): NudgeContext {
  return {
    payload: payload as never,
    tenant: { id: 7, timezone: opts.timezone ?? 'America/Chicago' },
    now: new Date(opts.now ?? '2026-06-11T17:00:00Z'), // Thu, noon Chicago
  }
}
