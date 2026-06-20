import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromContext, getTenantContext } from '@/lib/tenant-server'
import { submitForm } from '@/lib/form-submit'
import { sendFormNotifications } from '@/lib/form-notifications'
import { createFormCheckoutSession } from '@/lib/form-checkout'
import { createTuitionCheckout } from '@/lib/tuition-checkout'
import {
  computeSiblingDiscount,
  participantPricesCents,
  type DiscountTier,
  type PricingContext,
} from '@/lib/tuition-pricing'
import { participantsFromSubmission } from '@/lib/school-enroll'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Resolve the per-program pricing context (pricingModel + per-program tuition,
 * plus a classId→tuitionCents map for per-class pricing) and the discount tiers
 * for a school-registration form, then compute the sibling-discounted per-child
 * amounts from the submission's participants.
 *
 * Returns the discounted per-child amounts (preserving submission order), the
 * program id + name (for checkout metadata / line-item labels), and the SUM.
 */
async function resolveRegistrationPricing(opts: {
  payload: Payload
  tenantId: string | number
  form: any
  submissionData: Record<string, unknown>
}): Promise<{
  discountedCents: number[]
  totalCents: number
  programId: string | number | null
  programName: string
  paymentModel: 'free' | 'one-time' | 'monthly'
  currency: string
} | null> {
  const { payload, tenantId, form, submissionData } = opts

  const programRaw = form.registrationProgram
  const programId =
    programRaw == null
      ? null
      : typeof programRaw === 'object'
        ? (programRaw as { id: string | number }).id
        : (programRaw as string | number)
  if (programId == null) return null

  // Load the program term: pricingModel + per-program tuitionCents.
  const program = (await payload.findByID({
    collection: 'terms',
    id: programId,
    depth: 0,
    overrideAccess: true,
  })) as any
  if (!program) return null

  const pricingModel: PricingContext['pricingModel'] =
    program.pricingModel === 'per-class' ? 'per-class' : 'per-program'

  // For per-class pricing, load the program's classes into a classId→cents map.
  const classPrices: Record<string, number> = {}
  if (pricingModel === 'per-class') {
    const classes = await payload.find({
      collection: 'school-classes',
      where: { and: [{ tenant: { equals: tenantId } }, { term: { equals: programId } }] },
      depth: 0,
      overrideAccess: true,
      limit: 0,
    })
    for (const c of classes.docs as Array<{ id: string | number; tuitionCents?: number | null }>) {
      classPrices[String(c.id)] = Number(c.tuitionCents) || 0
    }
  }

  const ctx: PricingContext = {
    pricingModel,
    programTuitionCents: Number(program.tuitionCents) || 0,
    classPrices,
  }

  // Participants: the repeatable-group array for the children model; the
  // top-level submission itself for the self model (one participant).
  const groupKey =
    form.registration?.participantModel === 'children'
      ? (schemaGroups(form.schema)[0]?.name ?? null)
      : null
  const participants = participantsFromSubmission(submissionData, groupKey)

  const base = participantPricesCents(participants, ctx)
  // Sibling-discount tiers + cadence + currency are program-level pricing policy.
  const tiers = (program.multiChildDiscount ?? []) as DiscountTier[]
  const discountedCents = computeSiblingDiscount(base, tiers)
  const totalCents = discountedCents.reduce((sum, c) => sum + c, 0)

  return {
    discountedCents,
    totalCents,
    programId,
    programName: form.title ?? 'Program',
    paymentModel: (program.paymentModel ?? 'free') as 'free' | 'one-time' | 'monthly',
    currency: (program.currency as string) ?? 'usd',
  }
}

/** Return the repeatable-group fields declared in the form schema. */
function schemaGroups(
  schema: { steps?: { fields?: { name?: string; type?: string }[] }[] } | null | undefined,
): { name?: string }[] {
  const groups: { name?: string }[] = []
  for (const step of schema?.steps ?? []) {
    for (const f of step.fields ?? []) {
      if (f?.type === 'repeatable-group') groups.push(f)
    }
  }
  return groups
}

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

  // Honeypot trip: fake a success so bots think they got through, but persist
  // nothing. MUST return before findByID — there is no submission row to fetch.
  if (result.honeypot) return NextResponse.json({ ok: true })

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

  const f = form as any
  const submissionData = ((submission as any).data ?? {}) as Record<string, unknown>
  const isRegistration = f.schoolRegistration === true

  // Registration forms: pricing, cadence (paymentModel) and currency all come
  // from the bound program — resolve once. Non-registration forms keep the
  // form-level currency and the legacy fixed/selected amount path.
  const regPricing = isRegistration
    ? await resolveRegistrationPricing({ payload, tenantId: tenant.id, form: f, submissionData })
    : null
  const paymentModel = isRegistration ? (regPricing?.paymentModel ?? 'free') : undefined
  const currency = isRegistration ? (regPricing?.currency ?? 'usd') : (f.payment?.currency ?? 'usd')

  // ── Monthly recurring tuition (school registration) ───────────────────────
  // One family subscription (one Stripe customer per guardian email) with one
  // recurring line item per child at the sibling-discounted amount. Students +
  // the family record are created by the tuition webhook after payment.
  if (isRegistration && paymentModel === 'monthly') {
    const pricing = regPricing
    if (!pricing || pricing.discountedCents.length === 0) {
      payload.logger.error(
        { formId: form.id, submissionId: result.submissionId },
        'tuition checkout: could not resolve pricing/participants',
      )
      return NextResponse.json({ error: 'payment_unavailable' }, { status: 502 })
    }
    const guardianEmail =
      (typeof submissionData.guardian_email === 'string' && submissionData.guardian_email) ||
      (submission as any).submitterEmail ||
      ''
    const origin = pickOrigin(tenant as any)
    let checkoutUrl: string | null
    try {
      checkoutUrl = await createTuitionCheckout({
        tenant: tenant as any,
        guardianEmail,
        guardianName:
          typeof submissionData.guardian_name === 'string' ? submissionData.guardian_name : undefined,
        discountedCents: pricing.discountedCents,
        currency,
        programName: pricing.programName,
        tenantId: String(tenant.id),
        submissionId: String(result.submissionId),
        programId: String(pricing.programId),
        successUrl: `${origin}/api/forms/${f.slug}/checkout-success?sid={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/forms/${f.slug}?cancelled=${result.submissionId}`,
      })
    } catch (err) {
      payload.logger.error({ err, formId: form.id, submissionId: result.submissionId }, 'tuition checkout session failed')
      return NextResponse.json({ error: 'payment_unavailable' }, { status: 502 })
    }
    await payload.update({
      collection: 'form-submissions',
      id: result.submissionId,
      data: { amountCents: pricing.totalCents, currency },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true, checkoutUrl })
  }

  // ── One-time payment ───────────────────────────────────────────────────────
  // For school-registration forms, the charge is the sibling-discounted SUM of
  // per-child tuition; for flat/non-registration forms, the existing
  // selected/fixed amount path is preserved unchanged.
  let amount: number
  if (isRegistration && paymentModel === 'one-time') {
    const pricing = regPricing
    if (!pricing) {
      payload.logger.error(
        { formId: form.id, submissionId: result.submissionId },
        'one-time registration checkout: could not resolve pricing',
      )
      return NextResponse.json({ error: 'payment_unavailable' }, { status: 502 })
    }
    amount = pricing.totalCents
  } else {
    amount = Number(body._amount_cents) || f.payment?.priceCents || 0
  }

  let checkout
  try {
    checkout = await createFormCheckoutSession({
      payload,
      tenant: tenant as any,
      form: form as any,
      submission: submission as any,
      amountCents: amount,
    })
  } catch (err) {
    payload.logger.error({ err, formId: form.id, submissionId: result.submissionId }, 'form checkout session failed')
    return NextResponse.json({ error: 'payment_unavailable' }, { status: 502 })
  }
  await payload.update({
    collection: 'form-submissions',
    id: result.submissionId,
    data: {
      stripeCheckoutSessionId: checkout.id,
      amountCents: amount,
      currency,
    },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, checkoutUrl: checkout.url })
}

function pickOrigin(t: {
  customDomains?: Array<string | { domain: string }> | null
  slug?: string | null
}): string {
  const first = t.customDomains?.[0]
  const cd = typeof first === 'string' ? first : first?.domain
  if (cd) return `https://${cd}`
  return `https://${t.slug}.openmasjid.app`
}
