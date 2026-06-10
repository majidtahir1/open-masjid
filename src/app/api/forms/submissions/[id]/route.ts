/**
 * DELETE /api/forms/submissions/[id]
 *
 * Soft-deletes a form submission (sets `deletedAt` — the collection has
 * `trash: true`, so trashed docs disappear from all default queries:
 * spreadsheet, counts, CSV exports, and capacity checks). The row stays in
 * the database so payment-linked records are preserved and mistakes are
 * recoverable via the API.
 *
 * Auth required. Tenant scoping is enforced by reading the submission with
 * the caller's access (`overrideAccess: false`), which works on any admin
 * host — no hostname-derived tenant needed.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const payload = await getPayload({ config })
  const h = await headers()
  const auth = await payload.auth({ headers: h })
  const user = auth.user
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Visible to this user (tenant-scoped read access) and not already trashed?
  let submission: { id: string | number } | null = null
  try {
    submission = (await payload.findByID({
      collection: 'form-submissions',
      id,
      depth: 0,
      overrideAccess: false,
      user,
    })) as { id: string | number }
  } catch {
    submission = null
  }
  if (!submission) {
    return NextResponse.json({ error: 'submission not found' }, { status: 404 })
  }

  await payload.update({
    collection: 'form-submissions',
    id: submission.id,
    data: { deletedAt: new Date().toISOString() },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
