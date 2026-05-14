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
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname

  // Canonical host: 301 redirect www.openmasjid.app → apex. Keep query string
  // and pathname intact. Local dev (localhost / *.localhost) and tenant hosts
  // are unaffected because we only match this exact host.
  const bareHostForRedirect = host.split(':')[0].toLowerCase()
  if (bareHostForRedirect === 'www.openmasjid.app') {
    const search = request.nextUrl.search || ''
    return NextResponse.redirect(`https://openmasjid.app${pathname}${search}`, 301)
  }

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

  // On the platform marketing host (`openmasjid.app`), rewrite root-level
  // requests to the internal `/marketing/*` route group so URLs stay clean
  // (`openmasjid.app/pricing`) while the Next.js app keeps its real routes
  // colocated under `(marketing)/marketing/*`. This avoids colliding with
  // the `(site)/[slug]` catch-all that owns root paths on tenant hosts.
  //
  // In dev, bare `localhost` / `127.0.0.1` (no subdomain) is treated as the
  // platform marketing host so the marketing site is reachable at
  // `localhost:3000/`. Tenant subdomains (`icp.localhost:3000`) still
  // classify as `localhost` but include a subdomain, so we exclude those.
  const bareHost = host.split(':')[0].toLowerCase()
  const isBareLocalhost = bareHost === 'localhost' || bareHost === '127.0.0.1' || bareHost === '0.0.0.0'
  const treatAsMarketing =
    context.type === 'platform-marketing' || (context.type === 'localhost' && isBareLocalhost)

  if (
    treatAsMarketing &&
    !pathname.startsWith('/marketing') &&
    !pathname.startsWith('/admin') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/kiosk') &&
    !pathname.startsWith('/_next')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = pathname === '/' ? '/marketing' : `/marketing${pathname}`
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

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
