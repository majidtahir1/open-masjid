/**
 * /forms/[slug] — public form page.
 *
 * Server Component: resolves the current tenant, loads the form (status
 * 'published' OR 'closed'), checks capacity, and renders PublicFormClient
 * inside an om-pf-shell wrapper that sets --pf-brand from the tenant's
 * primary brand color.
 *
 * Artboards: 5.1 public-empty, 5.2 public-filled, 5.3 public-multi, 6.1 mobile.
 */
import type React from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { PublicFormClient } from './PublicFormClient'
import RichText from '@/components/RichText'
import '@/styles/public-forms.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FormPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tenant = await getCurrentTenant()
  if (!tenant) notFound()

  const payload = await getPayload({ config })

  const found = await payload.find({
    collection: 'forms',
    where: {
      and: [
        { tenant: { equals: tenant.id } },
        { slug: { equals: slug } },
        { status: { in: ['published', 'closed'] } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  const form = found.docs[0]
  if (!form) notFound()

  // Check capacity — if capacity is defined and the submission count meets or
  // exceeds it, treat the form as closed regardless of its status field.
  let isFull = false
  if (form.status === 'published' && form.settings?.capacity) {
    const counted = await payload.count({
      collection: 'form-submissions',
      where: {
        and: [
          { form: { equals: form.id } },
          { paymentStatus: { not_in: ['expired'] } },
        ],
      },
    })
    if (counted.totalDocs >= form.settings.capacity) {
      isFull = true
    }
  }

  const closed = form.status === 'closed' || isFull

  // Pull brand color from tenant branding — falls back to CSS default (#146E69)
  // when absent.
  const brandColor =
    (tenant.branding as { primaryColor?: string } | undefined)?.primaryColor ??
    undefined

  return (
    <div
      className="om-pf-shell"
      style={
        brandColor
          ? ({ '--pf-brand': brandColor } as React.CSSProperties)
          : undefined
      }
    >
      <header className="om-pf-header">
        <h1 className="om-pf-title">{form.title}</h1>
        {form.description ? (
          <RichText data={form.description as never} className="om-pf-description" />
        ) : null}
      </header>
      <PublicFormClient form={form as any} closed={closed} />
    </div>
  )
}
