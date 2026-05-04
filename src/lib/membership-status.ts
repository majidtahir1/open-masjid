// src/lib/membership-status.ts
export type MemberBucket = 'active' | 'grace' | 'inactive'

export function bucketFromStripeStatus(stripeStatus: string | null | undefined): MemberBucket {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'grace'
    default:
      return 'inactive'
  }
}
