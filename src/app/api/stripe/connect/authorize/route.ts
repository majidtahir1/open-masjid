import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { buildAuthorizeUrl } from '@/lib/stripe-connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
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
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host = h.get('host')
  const redirectUri = `${proto}://${host}/api/stripe/connect/callback`
  const url = buildAuthorizeUrl({ tenantId, userId: user.id, redirectUri })
  return NextResponse.redirect(url)
}
