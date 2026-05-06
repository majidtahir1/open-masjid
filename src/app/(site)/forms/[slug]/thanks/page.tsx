/**
 * /forms/[slug]/thanks — post-payment success page.
 *
 * Reached after Stripe redirects back. Looks up the submission by `?s=<id>`
 * and renders the full success card (artboard 5.4).
 */
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { PublicFormSuccess } from '@/components/PublicFormSuccess'
import '@/styles/public-forms.css'
import type React from 'react'

export const dynamic = 'force-dynamic'

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

  const payload = await getPayload({ config })

  const submission = await payload.findByID({
    collection: 'form-submissions',
    id: s,
    overrideAccess: true,
  })

  if (!submission) notFound()

  // Guard: submission must belong to this tenant
  const submissionTenantId =
    typeof submission.tenant === 'object' ? submission.tenant.id : submission.tenant
  if (String(submissionTenantId) !== String(tenant.id)) notFound()

  const formId =
    typeof submission.form === 'object' ? submission.form.id : submission.form

  const form = await payload.findByID({
    collection: 'forms',
    id: formId,
    overrideAccess: true,
  })

  // Determine brand color from tenant for shell styling
  const brandColor =
    (tenant.branding as { primaryColor?: string } | undefined)?.primaryColor ?? undefined

  return (
    <div
      className="om-pf-shell"
      style={brandColor ? ({ '--pf-brand': brandColor } as React.CSSProperties) : undefined}
    >
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
  )
}
