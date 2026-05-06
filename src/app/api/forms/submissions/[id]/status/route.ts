/**
 * PATCH /api/forms/submissions/[id]/status
 *
 * Updates the `status` field on a form-submission document.
 * Auth required; tenant-scoped (the submission must belong to the
 * authenticated user's tenant). Any → any transitions are permitted
 * so admins can roll forward and backward.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES = ['new', 'reviewed', 'archived'] as const
type SubmissionStatus = (typeof ALLOWED_STATUSES)[number]

interface SubmissionDoc {
  id: string | number
  tenant?: { id: string | number } | string | number | null
  status?: SubmissionStatus
}

interface PatchBody {
  status?: unknown
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Parse submission ID from route
  const { id } = await params

  // 2. Auth — require a valid Payload session
  const payload = await getPayload({ config })
  const h = await headers()
  const auth = await payload.auth({ headers: h })
  const user = auth.user
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 3. Parse + validate request body
  const body = (await req.json().catch(() => ({}))) as PatchBody
  const nextStatus = body.status

  if (!nextStatus || !ALLOWED_STATUSES.includes(nextStatus as SubmissionStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 },
    )
  }

  // 4. Resolve the authenticated user's tenant
  const tenant = await getCurrentTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'tenant not found' }, { status: 401 })
  }

  // 5. Find the submission, respecting access control so we only see
  //    submissions that belong to this tenant/user
  let existing: SubmissionDoc | null = null
  try {
    existing = (await payload.findByID({
      collection: 'form-submissions' as never,
      id,
      depth: 0,
      overrideAccess: false,
      user,
    } as never)) as unknown as SubmissionDoc
  } catch {
    // findByID throws (or returns null) when not found or access denied
    existing = null
  }

  if (!existing) {
    return NextResponse.json({ error: 'submission not found' }, { status: 404 })
  }

  // 6. Extra tenant guard — verify the submission belongs to the current tenant
  const submissionTenantId =
    existing.tenant && typeof existing.tenant === 'object'
      ? existing.tenant.id
      : existing.tenant
  const currentTenantId = tenant.id

  if (String(submissionTenantId) !== String(currentTenantId)) {
    return NextResponse.json({ error: 'submission not found' }, { status: 404 })
  }

  // 7. Apply the status update (override access so the collection's update: false
  //    doesn't block our intentional admin action; we've already verified scope above)
  const updated = (await payload.update({
    collection: 'form-submissions' as never,
    id,
    data: { status: nextStatus },
    overrideAccess: true,
    depth: 0,
  } as never)) as unknown as SubmissionDoc

  return NextResponse.json(updated, { status: 200 })
}
