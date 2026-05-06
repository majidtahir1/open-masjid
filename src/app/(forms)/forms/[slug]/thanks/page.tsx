/**
 * /forms/[slug]/thanks — post-payment success page.
 *
 * Reached after Stripe redirects back. Looks up the submission by `?s=<id>`
 * and renders the full success card (artboard 5.4).
 */
import { notFound } from 'next/navigation'
import { getCurrentTenant } from '@/lib/tenant-server'
import { getPayloadClient } from '@/lib/payloadClient'
import { PublicFormSuccess } from '@/components/PublicFormSuccess'
import '@/styles/public-forms.css'
import type React from 'react'

export const dynamic = 'force-dynamic'

interface PublicSubmissionRecord {
  id: string | number
  tenant?: { id: string | number } | string | number | null
  form?: { id: string | number } | string | number | null
  data?: Record<string, unknown> | null
  paymentStatus?: string | null
  amountCents?: number | null
  currency?: string | null
}

export default async function ThanksPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ s?: string }>
}) {
  const { slug } = await params
  const { s } = await searchParams

  // s is required — without a submission id we can't render the receipt
  if (!s) notFound()

  const tenant = await getCurrentTenant()
  if (!tenant) notFound()

  const payload = await getPayloadClient()
  if (!payload) notFound()

  const submission = (await payload.findByID({
    collection: 'form-submissions',
    id: s,
    overrideAccess: true,
  })) as PublicSubmissionRecord | null

  if (!submission) notFound()

  // Guard: submission must belong to this tenant
  const subTenant = submission.tenant
  if (!subTenant) notFound()
  const submissionTenantId = typeof subTenant === 'object' ? subTenant.id : subTenant
  if (String(submissionTenantId) !== String(tenant.id)) notFound()

  const subForm = submission.form
  if (!subForm) notFound()
  const formId = typeof subForm === 'object' ? subForm.id : subForm
  if (formId === undefined) notFound()

  const form = await payload.findByID({
    collection: 'forms',
    id: formId,
    overrideAccess: true,
  })

  // Determine brand color from tenant for shell styling
  const brandColor =
    (tenant.branding as { primaryColor?: string } | undefined)?.primaryColor ?? undefined

  return (
    <section className="om-pf-form-area">
      <div className="om-pf-form-area__inner">
        <PublicFormSuccess
          form={form as any}
          values={(submission.data as Record<string, unknown>) ?? {}}
          receipt={
            submission.paymentStatus === 'paid'
              ? {
                  id: submission.id,
                  amountCents: submission.amountCents,
                  currency: submission.currency,
                }
              : undefined
          }
          // slug is available for symmetry / future "back to form" link
          formSlug={slug}
        />
      </div>
    </section>
  )
}
