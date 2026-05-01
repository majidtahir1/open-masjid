import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifyState, exchangeCode, fetchAccount } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return NextResponse.redirect(new URL('/admin/donations/connect?status=missing', url))
  }
  let decoded
  try {
    decoded = verifyState(state)
  } catch {
    return NextResponse.redirect(
      new URL('/admin/donations/connect?status=invalid_state', url),
    )
  }
  const payload = await getPayload({ config })
  const h = await headers()
  const auth = await payload.auth({ headers: h })
  if (!auth.user || String(auth.user.id) !== String(decoded.userId)) {
    return NextResponse.redirect(
      new URL('/admin/donations/connect?status=user_mismatch', url),
    )
  }
  const sessionTenantId =
    typeof auth.user.tenant === 'object' && auth.user.tenant !== null
      ? (auth.user.tenant as { id: string | number }).id
      : (auth.user.tenant as string | number | null | undefined)
  if (String(sessionTenantId) !== String(decoded.tenantId)) {
    return NextResponse.redirect(
      new URL('/admin/donations/connect?status=tenant_mismatch', url),
    )
  }
  const { stripeUserId } = await exchangeCode(code)
  const account = await fetchAccount(stripeUserId)
  await payload.update({
    collection: 'tenants',
    id: decoded.tenantId as string | number,
    data: {
      donationConfig: {
        mode: 'connect',
        stripeAccountId: stripeUserId,
        stripeAccountConnectedAt: new Date().toISOString(),
        stripeChargesEnabled: !!account.charges_enabled,
        stripePayoutsEnabled: !!account.payouts_enabled,
        stripeAccountLastSyncedAt: new Date().toISOString(),
      },
    },
    overrideAccess: true,
  })
  return NextResponse.redirect(new URL('/admin/donations/connect?status=success', url))
}
