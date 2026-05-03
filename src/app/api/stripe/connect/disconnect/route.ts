import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { disconnectAccount } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const payload = await getPayload({ config })
  const h = await headers()
  const auth = await payload.auth({ headers: h })
  const user = auth.user
  if (!user || (user.role !== 'admin' && user.role !== 'platformOwner')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? (user.tenant as { id: string | number }).id
      : (user.tenant as string | number | null | undefined)
  if (!tenantId) return NextResponse.json({ error: 'no tenant' }, { status: 400 })
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    overrideAccess: true,
  })
  const acct = (tenant as { donationConfig?: { stripeAccountId?: string | null } } | null)
    ?.donationConfig?.stripeAccountId
  if (acct) {
    try {
      await disconnectAccount(acct)
    } catch (err) {
      payload.logger.warn(`stripe-connect disconnect: ${(err as Error).message}`)
    }
  }
  await payload.update({
    collection: 'tenants',
    id: tenantId,
    overrideAccess: true,
    data: {
      donationConfig: {
        mode: 'external',
        stripeAccountId: null,
        stripeAccountConnectedAt: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeAccountLastSyncedAt: null,
      },
    },
  })
  return NextResponse.json({ disconnected: true })
}
