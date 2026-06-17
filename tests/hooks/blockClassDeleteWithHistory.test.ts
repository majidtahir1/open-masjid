import { describe, it, expect, vi } from 'vitest'
import { blockClassDeleteWithHistory } from '@/hooks/blockClassDeleteWithHistory'

function reqWith(counts: Record<string, number>) {
  return {
    payload: {
      find: vi.fn(async ({ collection }: { collection: string }) => ({ totalDocs: counts[collection] ?? 0 })),
    },
  } as any
}

describe('blockClassDeleteWithHistory', () => {
  it('allows delete when no enrollments or sessions', async () => {
    await expect(blockClassDeleteWithHistory({ req: reqWith({}), id: 5 } as any)).resolves.toBeUndefined()
  })
  it('throws when the class has enrollments', async () => {
    await expect(blockClassDeleteWithHistory({ req: reqWith({ enrollments: 2 }), id: 5 } as any)).rejects.toThrow()
  })
  it('throws when the class has sessions', async () => {
    await expect(blockClassDeleteWithHistory({ req: reqWith({ 'class-sessions': 12 }), id: 5 } as any)).rejects.toThrow()
  })
})
