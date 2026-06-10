import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { submissionsToCsv } from '@/lib/form-csv'
import type { FormSchema } from '@/lib/form-schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface FormDoc {
  id: string | number
  slug: string
  schema: FormSchema
  tenant: { id: string | number } | string | number
  payment?: { enabled?: boolean | null } | null
}

/**
 * The [slug] segment accepts either a form id or a slug. Ids are globally
 * unique, so id-based lookups work from any admin host — including the
 * platform admin host, where no tenant can be derived from the hostname.
 * Slug lookups need the host tenant to disambiguate (slugs are per-tenant).
 * Access control (`overrideAccess: false` + user) enforces tenant scoping
 * either way.
 */

interface SubmissionDoc {
  submittedAt: string | Date
  status: string
  paymentStatus: string
  submitterEmail: string
  data: Record<string, unknown>
  amountCents?: number | null
  currency?: string | null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Auth: load Payload, verify a valid session exists
  const payload = await getPayload({ config })
  const h = await headers()
  const auth = await payload.auth({ headers: h })
  const user = auth.user
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 2. Look up the form — by id when the segment is numeric, else by
  //    slug scoped to the host tenant.
  const { slug } = await params
  let form: FormDoc | undefined

  if (/^\d+$/.test(slug)) {
    try {
      const byId = (await payload.find({
        collection: 'forms' as never,
        where: { id: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: false,
        user,
      } as never)) as unknown as { docs: FormDoc[] }
      form = byId.docs[0]
    } catch {
      // Not a valid id for this database — fall through to the slug lookup.
    }
  }

  if (!form) {
    const tenant = await getCurrentTenant()
    if (!tenant) {
      return NextResponse.json({ error: 'no tenant' }, { status: 401 })
    }
    const bySlug = (await payload.find({
      collection: 'forms' as never,
      where: {
        slug: { equals: slug },
        tenant: { equals: tenant.id },
      },
      limit: 1,
      depth: 0,
      overrideAccess: false,
      user,
    } as never)) as unknown as { docs: FormDoc[] }
    form = bySlug.docs[0]
  }

  if (!form) {
    return NextResponse.json({ error: 'form not found' }, { status: 404 })
  }

  // 4. Query submissions for this form (?id=<submissionId> narrows to one row)
  const id = new URL(req.url).searchParams.get('id')
  const submissions = (await payload.find({
    collection: 'form-submissions' as never,
    where: {
      form: { equals: form.id },
      ...(id ? { id: { equals: id } } : {}),
    },
    limit: 10000,
    overrideAccess: false,
    user,
  } as never)) as unknown as { docs: SubmissionDoc[] }

  // 5. Generate CSV (payment columns only for payment-enabled forms)
  const csv = submissionsToCsv(form.schema, submissions.docs, {
    includePayment: !!form.payment?.enabled,
  })

  // 6. Build filename with today's date (always use the slug, even when the
  //    request came in by id)
  const today = new Date().toISOString().slice(0, 10)
  const filename = `${form.slug || slug}-submissions-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
