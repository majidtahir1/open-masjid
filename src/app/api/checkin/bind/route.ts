import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { getCurrentTenant } from '@/lib/tenant-server'
import { pinMatches, signKioskToken } from '@/lib/checkin/kiosk'

export const runtime = 'nodejs'

/**
 * GET — staff setup screen bootstrap. Returns the masjid name and its active
 * programs so the iPad can show the program picker. Host-scoped, no auth (only
 * non-sensitive program names are exposed).
 */
export async function GET() {
  const tenant = await getCurrentTenant()
  if (!tenant) return NextResponse.json({ error: 'no-tenant' }, { status: 404 })

  const payload = await getPayloadClient()
  if (!payload) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const pinSet = Boolean((tenant as any).checkinKiosk?.pin)
  const programs = await payload.find({
    collection: 'terms',
    where: { and: [{ tenant: { equals: tenant.id } }, { status: { equals: 'active' } }] },
    sort: '-startDate',
    depth: 0,
    limit: 50,
    overrideAccess: true,
  })

  return NextResponse.json({
    tenant: { name: (tenant as any).name ?? 'Masjid' },
    pinSet,
    programs: programs.docs.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      meetingDays: p.meetingDays ?? [],
    })),
  })
}

/**
 * POST — bind this iPad. Verifies the staff PIN and that the program belongs to
 * the tenant, then mints a tenant+program-scoped kiosk token.
 */
export async function POST(req: Request) {
  const tenant = await getCurrentTenant()
  if (!tenant) return NextResponse.json({ error: 'no-tenant' }, { status: 404 })

  let body: { pin?: string; programId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 })
  }
  const { pin, programId } = body
  if (!pin || !programId) return NextResponse.json({ error: 'missing-fields' }, { status: 400 })

  const storedPin = (tenant as any).checkinKiosk?.pin
  if (!storedPin) return NextResponse.json({ error: 'kiosk-disabled' }, { status: 403 })
  if (!pinMatches(pin, storedPin)) return NextResponse.json({ error: 'bad-pin' }, { status: 401 })

  const payload = await getPayloadClient()
  if (!payload) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const program = await payload
    .findByID({ collection: 'terms', id: programId, overrideAccess: true })
    .catch(() => null)
  const programTenant = program ? String((program as any).tenant?.id ?? (program as any).tenant) : null
  if (!program || programTenant !== String(tenant.id) || (program as any).status !== 'active') {
    return NextResponse.json({ error: 'bad-program' }, { status: 400 })
  }

  const token = signKioskToken({ tenantId: String(tenant.id), programId: String(programId) })
  return NextResponse.json({
    token,
    program: { id: String(programId), name: (program as any).name },
    tenant: { name: (tenant as any).name ?? 'Masjid' },
  })
}
