/**
 * Resolve the optional "Learn more" link on a service card.
 *
 * Pure helper so the resolution rules are unit-testable:
 * - linkType 'page'  → `/${slug}` from the populated linkPage doc. A bare
 *   relationship id (number/string, i.e. not populated at fetch depth) cannot
 *   be resolved, so no link is rendered.
 * - linkType 'url'   → http(s) URLs are flagged external (new tab);
 *   root-relative paths (single leading `/`) are in-site links. Anything
 *   else — javascript:, data:, protocol-relative `//`, bare words — is
 *   rejected: tenant editors must not be able to store a link that executes
 *   script in the site's origin (stored XSS).
 * - linkType 'none' / missing → no link.
 */

export interface ResolvedServiceLink {
  href: string
  external: boolean
}

export interface ServiceLinkInput {
  linkType?: 'none' | 'page' | 'url' | null
  /** Populated page doc, or a bare id when not populated. */
  linkPage?: { slug?: string | null } | string | number | null
  linkUrl?: string | null
}

export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

/** Root-relative in-site path: single leading slash (not protocol-relative `//`). */
export function isRootRelativeHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

/** True when a stored URL is safe to render as a link. */
export function isSafeServiceHref(href: string): boolean {
  return isExternalHref(href) || isRootRelativeHref(href)
}

export function resolveServiceLink(
  service: ServiceLinkInput,
): ResolvedServiceLink | null {
  if (service.linkType === 'page') {
    const page = service.linkPage
    if (!page || typeof page !== 'object') return null // bare id or missing
    const slug = page.slug?.trim()
    if (!slug) return null
    return { href: `/${slug}`, external: false }
  }

  if (service.linkType === 'url') {
    const url = service.linkUrl?.trim()
    if (!url || !isSafeServiceHref(url)) return null
    return { href: url, external: isExternalHref(url) }
  }

  return null
}
