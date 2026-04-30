import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  cached = new Stripe(key, { apiVersion: '2025-02-24.acacia' })
  return cached
}

export function getPriceId(plan: 'monthly' | 'annual'): string {
  const id = plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_ANNUAL
  if (!id) throw new Error(`Missing Stripe price env var for plan=${plan}`)
  return id
}
