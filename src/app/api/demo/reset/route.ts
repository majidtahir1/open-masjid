import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resetDemoContent } from '@/lib/demo/seedDemo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET ?? ''
  if (!expected) return false // fail closed when unset
  const provided = req.headers.get('x-cron-secret') ?? ''
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const payload = await getPayload({ config })
  const { tenantId } = await resetDemoContent(payload)
  return NextResponse.json({ reset: true, tenantId })
}
