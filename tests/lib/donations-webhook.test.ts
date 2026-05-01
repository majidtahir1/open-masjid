import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/stripe/connect/webhook/route'

describe('connect webhook', () => {
  it('rejects requests without signature', async () => {
    const req = new Request('http://localhost/api/stripe/connect/webhook', {
      method: 'POST',
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
