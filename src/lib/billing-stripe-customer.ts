import type Stripe from 'stripe'

export async function createCustomerForTenant(
  stripe: Stripe,
  args: { tenantId: number | string; slug: string; name: string; email: string },
): Promise<string> {
  const customer = await stripe.customers.create({
    email: args.email,
    name: args.name,
    metadata: { tenantId: String(args.tenantId), slug: args.slug },
  })
  return customer.id
}
