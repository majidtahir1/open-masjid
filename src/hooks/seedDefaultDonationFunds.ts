import type { CollectionAfterChangeHook } from 'payload'

/**
 * After a tenant is created, seed two default donation funds so the donate
 * page has something to show out of the box. Tenants can rename, delete, or
 * add to these later.
 *
 * Uses overrideAccess: the seed runs as part of tenant creation and may
 * happen before the tenant's first user exists.
 */
export const seedDefaultDonationFunds: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc
  await req.payload.create({
    collection: 'donation-funds',
    data: {
      tenant: doc.id,
      name: 'Sadaqah',
      slug: 'sadaqah',
      zakatEligible: false,
      sortOrder: 0,
      active: true,
      suggestedAmounts: [{ amount: 25 }, { amount: 50 }, { amount: 100 }, { amount: 250 }],
    },
    overrideAccess: true,
  })
  await req.payload.create({
    collection: 'donation-funds',
    data: {
      tenant: doc.id,
      name: 'Zakat',
      slug: 'zakat',
      zakatEligible: true,
      sortOrder: 1,
      active: true,
      suggestedAmounts: [{ amount: 100 }, { amount: 250 }, { amount: 500 }],
    },
    overrideAccess: true,
  })
  return doc
}

export default seedDefaultDonationFunds
