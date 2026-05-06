import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromContext, getTenantContext } from '@/lib/tenant-server'
import { submitForm } from '@/lib/form-submit'
import { sendFormNotifications } from '@/lib/form-notifications'
import { createFormCheckoutSession } from '@/lib/form-checkout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await getTenantContext()
  const tenant = await resolveTenantFromContext(ctx)
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })

  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'forms',
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { slug: { equals: slug } },
        { status: { equals: 'published' } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  const form = found.docs[0]
  if (!form) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '0.0.0.0'
  const userAgent = req.headers.get('user-agent') || ''

  const result = await submitForm({ payload, form: form as any, data: body, ip, userAgent })
  if (!result.ok) {
    if (result.error === 'rate_limited') return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    if (result.error === 'closed') return NextResponse.json({ error: 'closed' }, { status: 410 })
    if (result.error === 'validation')
      return NextResponse.json({ error: 'validation', fieldErrors: result.errors }, { status: 422 })
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  if (!result.checkoutPending) {
    const submission = await payload.findByID({
      collection: 'form-submissions',
      id: result.submissionId,
      overrideAccess: true,
    })
    await sendFormNotifications({ form: form as any, submission: submission as any })
    return NextResponse.json({ ok: true })
  }

  const submission = await payload.findByID({
    collection: 'form-submissions',
    id: result.submissionId,
    overrideAccess: true,
  })
  const amount = Number(body._amount_cents) || (form as any).payment?.priceCents || 0
  const checkout = await createFormCheckoutSession({
    payload,
    tenant: tenant as any,
    form: form as any,
    submission: submission as any,
    amountCents: amount,
  })
  await payload.update({
    collection: 'form-submissions',
    id: result.submissionId,
    data: {
      stripeCheckoutSessionId: checkout.id,
      amountCents: amount,
      currency: (form as any).payment?.currency ?? 'usd',
    },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, checkoutUrl: checkout.url })
}
