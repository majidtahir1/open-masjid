import { getPayload } from 'payload'
import config from '../src/payload.config'
import { cloneTenantContent, wipeTenantContent } from '@/lib/demo/cloneTenantContent'

/**
 * One-time import: clone the ICP tenant's visible site content (+ faithful media
 * files) into the public demo tenant, so the demo mirrors a real masjid. Wipes
 * the demo's existing content + media first, so re-runs yield a clean copy. PII
 * (members/donations/form-submissions/users) is never touched.
 *
 * Run with prod DATABASE_URI + a host that can reach the media volume:
 *   npm run import:demo
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tenantIdBySlug(payload: any, slug: string): Promise<string | number> {
  const res = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: slug } },
    limit: 1,
    overrideAccess: true,
  })
  const doc = res.docs[0]
  if (!doc) throw new Error(`No tenant with slug '${slug}'`)
  return doc.id
}

async function main() {
  const payload = await getPayload({ config })
  const icpId = await tenantIdBySlug(payload, 'icp')
  const demoId = await tenantIdBySlug(payload, 'demo')
  console.log(`Importing content: icp(${icpId}) -> demo(${demoId})`)
  await wipeTenantContent(payload, demoId)
  const report = await cloneTenantContent(payload, icpId, demoId)
  console.log('✓ Import complete:', JSON.stringify(report))
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
