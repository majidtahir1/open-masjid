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
}

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
  _req: Request,
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

  // 2. Resolve tenant from request context
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'no tenant' }, { status: 401 })
  }

  // 3. Look up the form by slug + tenant
  const { slug } = await params
  const formsResult = (await payload.find({
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

  const form = formsResult.docs[0]
  if (!form) {
    return NextResponse.json({ error: 'form not found' }, { status: 404 })
  }

  // 4. Query all submissions for this form
  const submissions = (await payload.find({
    collection: 'form-submissions' as never,
    where: {
      form: { equals: form.id },
    },
    limit: 10000,
    overrideAccess: false,
    user,
  } as never)) as unknown as { docs: SubmissionDoc[] }

  // 5. Generate CSV
  const csv = submissionsToCsv(form.schema, submissions.docs)

  // 6. Build filename with today's date
  const today = new Date().toISOString().slice(0, 10)
  const filename = `${slug}-submissions-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
