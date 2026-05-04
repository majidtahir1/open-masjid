import type { Access, CollectionConfig } from 'payload'
import { tenantScopedAccess } from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { syncTierAfterChange } from './MembershipTiers.hooks'

/**
 * Returns the tenant id from a user object regardless of whether user.tenant
 * is a raw id or a populated object.
 */
function getTenantId(tenant: unknown): string | number | null {
  if (!tenant) return null
  if (typeof tenant === 'object' && tenant !== null && 'id' in tenant) {
    return (tenant as { id: string | number }).id
  }
  return tenant as string | number
}

/**
 * Create / Update: platformOwner can always; tenant admins can within their
 * tenant; staff are read-only (return false).
 */
const adminOrPlatformOwnerOnly: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'platformOwner') return true
  if (user.role !== 'admin') return false
  const tenantId = getTenantId((user as { tenant?: unknown }).tenant)
  return Boolean(tenantId)
}

/**
 * MembershipTiers — paid recurring dues offered by a tenant. Each tier maps
 * 1:1 to a Stripe Product + Price on the tenant's connected account. Prices
 * are immutable in Stripe, so amount/cadence changes rotate to a new Price
 * and archive the old one (existing subscribers continue billing on the
 * archived Price). Hard delete is forbidden — use `active = false` instead.
 */
export const MembershipTiers: CollectionConfig = {
  slug: 'membership-tiers',
  labels: { singular: 'Membership tier', plural: 'Membership tiers' },
  admin: {
    group: 'Membership',
    useAsTitle: 'name',
    defaultColumns: ['name', 'amount', 'cadence', 'active', 'sortOrder'],
    description: 'Paid recurring tiers congregants can subscribe to.',
  },
  access: {
    read: tenantScopedAccess().read,
    create: adminOrPlatformOwnerOnly,
    update: adminOrPlatformOwnerOnly,
    delete: () => false,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
    afterChange: [
      async (args) => {
        if (args.req.context?.skipMembershipSync) return
        await syncTierAfterChange(args)
      },
    ],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { readOnly: true } },
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'richText' },
    // The persisted column lives in cents (Stripe-canonical), but admins
    // enter and see the value in dollars via the virtual `amount` field
    // below. `amountCents` is hidden from the editor and populated by the
    // beforeValidate hook on `amount`.
    {
      name: 'amountCents',
      type: 'number',
      required: true,
      min: 1,
      admin: { hidden: true },
    },
    {
      name: 'amount',
      type: 'number',
      virtual: true,
      required: true,
      min: 1,
      label: 'Amount',
      admin: {
        description: 'Dollars per period. Example: enter 25 for $25 / month.',
        step: 1,
      },
      hooks: {
        // Read from the persisted amountCents → display dollars
        afterRead: [
          ({ siblingData }) => {
            const cents = (siblingData as { amountCents?: number | null })?.amountCents
            return typeof cents === 'number' ? cents / 100 : undefined
          },
        ],
        // Write dollars → persisted amountCents (rounds to nearest cent)
        beforeValidate: [
          ({ value, siblingData }) => {
            if (typeof value === 'number' && Number.isFinite(value)) {
              ;(siblingData as { amountCents?: number }).amountCents = Math.round(value * 100)
            }
            return value
          },
        ],
      },
    },
    {
      name: 'cadence',
      type: 'select',
      required: true,
      defaultValue: 'monthly',
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Yearly', value: 'yearly' },
      ],
    },
    { name: 'active', type: 'checkbox', defaultValue: true, admin: { description: 'Uncheck to soft-delete: hides from /membership but keeps existing subscribers billed.' } },
    { name: 'sortOrder', type: 'number', admin: { description: 'Lower numbers appear first on the public page.' } },

    // Stripe sync state — managed by hooks, read-only in admin
    { name: 'stripeProductId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'stripePriceId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'archivedPriceIds', type: 'array', admin: { readOnly: true, position: 'sidebar' }, fields: [{ name: 'priceId', type: 'text' }] },
    { name: 'lastStripeSyncAt', type: 'date', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'lastStripeSyncError', type: 'textarea', admin: { readOnly: true, position: 'sidebar' } },
  ],
  timestamps: true,
}

export default MembershipTiers
