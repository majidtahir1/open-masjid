import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { parseHostContext } from '@/lib/tenant-parse'

/**
 * OpenMasjid multi-tenant middleware (Edge runtime).
 *
 * Strict Edge-safety contract: this file and everything it imports
 * transitively must avoid `node:*` modules, Payload, and `next/headers`.
 * Only `@/lib/tenant-parse` is imported, which is a pure synchronous
 * classifier with zero runtime dependencies.
 *
 * Responsibilities:
 *   1. Parse the Host header into a cheap `TenantContext` classification.
 *   2. Attach that classification to both the forwarded request and the
 *      outgoing response via the `x-tenant-context` header, so server
 *      components (running in Node) can read it via `getTenantContext()`
 *      in `@/lib/tenant-server` without re-parsing.
 *   3. Enforce the security rule that `/admin` is not reachable on a
 *      tenant's custom public domain — admin lives only on
 *      `<slug>.openmasjid.app` and `admin.openmasjid.app`.
 *
 * Actual tenant record resolution happens later, in server components, via
 * `resolveTenantFromContext` in `@/lib/tenant-server` (Node runtime, Payload).
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  const context = parseHostContext(host)

  // Security: block `/admin` on custom public domains. Admin is only exposed
  // on `*.openmasjid.app` and never on a masjid's custom domain.
  if (context.type === 'tenant-custom' && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const serialized = JSON.stringify(context)

  // Propagate context to downstream handlers via a request header so that
  // server components can read it via `next/headers` without re-parsing.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-context', serialized)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Also expose on the outgoing response for debugging / observability.
  response.headers.set('x-tenant-context', serialized)

  return response
}

export const config = {
  matcher: [
    // Skip Next internals, favicon, public/static assets, and Payload's own
    // API/admin routes (which handle their own routing).
    '/((?!_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|brand|public|api/payload|api/payload-cloud).*)',
  ],
}
