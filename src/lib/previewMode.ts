import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'

/**
 * Decide whether the current public-site request should render draft content.
 *
 * Returns true only when BOTH:
 *   1. The URL carries `?draft=1` (or `true`) — opt-in signal.
 *   2. The request is authenticated as an admin user — via Payload's session
 *      cookie, shared across `/admin` and `/*` on the same origin.
 *
 * Unauthenticated visitors with `?draft=1` always get published content.
 */
export async function isPreviewMode(searchParams?: {
  draft?: string | string[] | undefined
}): Promise<boolean> {
  const raw = searchParams?.draft
  const flag = Array.isArray(raw) ? raw[0] : raw
  if (flag !== '1' && flag !== 'true') return false

  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: await getHeaders() })
    return Boolean(user)
  } catch {
    return false
  }
}
