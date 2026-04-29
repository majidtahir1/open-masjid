import { NextResponse } from 'next/server'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

type Action = { type: 'seen-welcome' }

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (user.role === 'platformOwner') {
    return NextResponse.json({ error: 'platform-owners do not onboard' }, { status: 403 })
  }

  const action = (await req.json()) as Action

  if (action.type === 'seen-welcome') {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { onboardingWelcomeSeenAt: new Date().toISOString() },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown-action' }, { status: 400 })
}
