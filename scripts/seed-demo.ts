import { getPayload } from 'payload'
import config from '../src/payload.config'
import { resetDemoContent, ensureDemoAdmin } from '@/lib/demo/seedDemo'

/**
 * Provision (or refresh) the public demo tenant: tenant doc + donation config,
 * membership tiers (which sync to TEST Stripe), website content, and the shared
 * demo admin user. Idempotent — safe to re-run. Requires DEMO_STRIPE_ACCOUNT_ID
 * and DEMO_ADMIN_PASSWORD in the environment.
 */
async function main() {
  const payload = await getPayload({ config })
  const { tenantId } = await resetDemoContent(payload)
  await ensureDemoAdmin(payload, tenantId)
  console.log('✓ Demo tenant provisioned:', tenantId)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
