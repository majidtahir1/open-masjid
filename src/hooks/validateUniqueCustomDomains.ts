import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'

/**
 * Reject a tenant save that claims a custom domain already owned by another
 * tenant. Public-site routing resolves a custom-domain host to a single
 * tenant (`findTenantByCustomDomain`, limit 1), so a duplicate claim would
 * make which site wins arbitrary — and would let one tenant's admin hijack
 * another masjid's domain via the REST API.
 *
 * The routing lookup treats `www.example.org` and `example.org` as the same
 * site, so uniqueness is enforced on the apex form (lowercased, `www.`
 * stripped) and the conflict query covers both variants.
 */
export const validateUniqueCustomDomains: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const entries = (data?.customDomains ?? []) as Array<string | { domain?: string | null }>
  const domains = entries
    .map((entry) => (typeof entry === 'string' ? entry : entry?.domain ?? ''))
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)

  if (domains.length === 0) return data

  const toApex = (domain: string) => (domain.startsWith('www.') ? domain.slice(4) : domain)

  const seen = new Set<string>()
  for (const domain of domains) {
    const apex = toApex(domain)
    if (seen.has(apex)) {
      throw new APIError(`Duplicate custom domain in this tenant: ${apex}`, 400)
    }
    seen.add(apex)
  }

  const currentId = originalDoc?.id ?? data?.id
  const candidates = [...seen].flatMap((apex) => [apex, `www.${apex}`])

  const conflicts = await req.payload.find({
    collection: 'tenants',
    where: {
      and: [
        ...(currentId != null ? [{ id: { not_equals: currentId } }] : []),
        { or: candidates.map((domain) => ({ 'customDomains.domain': { equals: domain } })) },
      ],
    },
    limit: 1,
    depth: 0,
  })

  const owner = conflicts.docs[0] as { name?: string } | undefined
  if (owner) {
    throw new APIError(
      `Custom domain already in use by another tenant (${owner.name ?? 'unknown'}): ${[...seen].join(', ')}`,
      400,
    )
  }

  return data
}
