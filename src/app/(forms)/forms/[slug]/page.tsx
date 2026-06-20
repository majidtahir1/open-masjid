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
import { getCurrentTenant } from '@/lib/tenant-server'
import { getPayloadClient } from '@/lib/payloadClient'
import { PublicFormClient } from './PublicFormClient'
import RichText from '@/components/RichText'
import { computeBackgroundCss, type Appearance } from '@/lib/form-appearance'
import '@/styles/public-forms.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PublicFormRecord {
  id: string | number
  title?: string | null
  description?: unknown
  status?: 'published' | 'closed' | string | null
  schoolRegistration?: boolean | null
  registrationProgram?: string | number | { id: string | number } | null
  settings?: {
    capacity?: number | null
  } | null
  appearance?: Appearance | null
}

export interface ProgramClass {
  id: string | number
  name: string
  tuitionCents: number | null
}

/** Program-level pricing the public form needs to show the tuition summary. */
export interface ProgramPricing {
  pricingModel: 'per-program' | 'per-class'
  /** Per-program monthly tuition (cents). Ignored when pricingModel is per-class. */
  tuitionCents: number | null
}

export default async function FormPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tenant = await getCurrentTenant()
  if (!tenant) notFound()

  const payload = await getPayloadClient()
  if (!payload) notFound()

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

  const form = (found.docs[0] as PublicFormRecord | undefined) ?? null
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

  // For per-class registration programs, load the program's ACTIVE classes so
  // the public form can render the per-participant class selector. Non-
  // registration forms (no schoolRegistration / no program) get an empty list.
  let programClasses: ProgramClass[] = []
  let programPricing: ProgramPricing | null = null
  const programRaw = form.registrationProgram
  const programId =
    programRaw && typeof programRaw === 'object' && 'id' in programRaw
      ? programRaw.id
      : (programRaw as string | number | null)
  if (form.schoolRegistration === true && programId) {
    // Load the program's pricing model + per-program tuition so the public
    // form can show the tuition summary (the actual charge is recomputed
    // server-side at submit; this is the display-only mirror).
    const program = (await payload.findByID({
      collection: 'terms',
      id: programId,
      overrideAccess: true,
    }).catch(() => null)) as { pricingModel?: string | null; tuitionCents?: number | null } | null
    if (program) {
      programPricing = {
        pricingModel: program.pricingModel === 'per-class' ? 'per-class' : 'per-program',
        tuitionCents: program.tuitionCents ?? null,
      }
    }
    const classesResult = await payload.find({
      collection: 'school-classes',
      where: {
        and: [
          { term: { equals: programId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1000,
      depth: 0,
      select: { name: true, tuitionCents: true },
      overrideAccess: true,
    })
    programClasses = classesResult.docs.map((c) => {
      const doc = c as { id: string | number; name?: string | null; tuitionCents?: number | null }
      return {
        id: doc.id,
        name: doc.name ?? '',
        tuitionCents: doc.tuitionCents ?? null,
      }
    })
  }

  // Background CSS from form.appearance (gradient overrides solid color)
  const backgroundCss = computeBackgroundCss(form.appearance ?? undefined)

  return (
    <section
      className="om-pf-form-area"
      style={
        backgroundCss
          ? ({ '--pf-bg': backgroundCss } as React.CSSProperties)
          : undefined
      }
    >
      <div className="om-pf-form-area__inner">
        <header className="om-pf-header">
          <h1 className="om-pf-title">{form.title}</h1>
          {form.description ? (
            <RichText data={form.description as never} className="om-pf-description" />
          ) : null}
        </header>
        <PublicFormClient
          form={form as any}
          closed={closed}
          programClasses={programClasses}
          programPricing={programPricing}
        />
      </div>
    </section>
  )
}
