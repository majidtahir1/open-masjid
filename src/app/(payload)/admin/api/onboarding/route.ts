import { NextResponse } from 'next/server'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MILESTONES, type MilestoneSlug } from '@/lib/onboarding'

type Action =
  | { type: 'mark-complete'; slug: MilestoneSlug }
  | { type: 'skip'; slug: MilestoneSlug }
  | { type: 'reset' }
  | { type: 'seen-welcome' }
  | { type: 'celebrate-dismissed' }

function tenantIdOf(t: unknown): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && t !== null && 'id' in t) {
    return (t as { id: string | number }).id
  }
  return t as string | number
}

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (user.role === 'platformOwner') {
    return NextResponse.json({ error: 'platform-owners do not onboard' }, { status: 403 })
  }
  const tenantId = tenantIdOf((user as { tenant?: unknown }).tenant)
  if (!tenantId) return NextResponse.json({ error: 'no-tenant' }, { status: 400 })

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

  // Read current onboarding state
  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as { onboarding?: Record<string, string | null> | null }
  const current = tenant.onboarding ?? {}

  let next: Record<string, string | null> = { ...current }
  let completedAt: string | null | undefined = undefined

  if (action.type === 'mark-complete') {
    if (!(MILESTONES as readonly string[]).includes(action.slug)) {
      return NextResponse.json({ error: 'bad-slug' }, { status: 400 })
    }
    next[action.slug] = 'complete'
  } else if (action.type === 'skip') {
    if (!(MILESTONES as readonly string[]).includes(action.slug)) {
      return NextResponse.json({ error: 'bad-slug' }, { status: 400 })
    }
    next[action.slug] = 'dismissed'
  } else if (action.type === 'reset') {
    // Reset all `dismissed` to null. Keep `complete` as-is.
    next = Object.fromEntries(
      MILESTONES.map((slug) => [slug, current[slug] === 'complete' ? 'complete' : null]),
    )
    completedAt = null
  } else if (action.type === 'celebrate-dismissed') {
    completedAt = new Date().toISOString()
  } else {
    return NextResponse.json({ error: 'unknown-action' }, { status: 400 })
  }

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      onboarding: next,
      ...(completedAt !== undefined ? { onboardingCompletedAt: completedAt } : {}),
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
