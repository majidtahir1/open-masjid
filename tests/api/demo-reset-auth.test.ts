import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('@/lib/demo/seedDemo', () => ({ resetDemoContent: vi.fn(async () => ({ tenantId: 7 })) }))

import { POST } from '@/app/api/demo/reset/route'
import { resetDemoContent } from '@/lib/demo/seedDemo'

function req(headers: Record<string, string>) {
  return new Request('http://x/api/demo/reset', { method: 'POST', headers })
}

describe('POST /api/demo/reset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 's3cret'
  })

  it('rejects when the secret is missing', async () => {
    const res = await POST(req({}))
    expect(res.status).toBe(403)
    expect(resetDemoContent).not.toHaveBeenCalled()
  })

  it('rejects a wrong secret', async () => {
    const res = await POST(req({ 'x-cron-secret': 'nope' }))
    expect(res.status).toBe(403)
  })

  it('runs the reset with the correct secret', async () => {
    const res = await POST(req({ 'x-cron-secret': 's3cret' }))
    expect(res.status).toBe(200)
    expect(resetDemoContent).toHaveBeenCalledOnce()
  })

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await POST(req({ 'x-cron-secret': '' }))
    expect(res.status).toBe(403)
  })
})
