import type { CollectionConfig } from 'payload'

/**
 * Members — congregants who have or have had a paid membership subscription
 * via Stripe Connect. Created and updated by the membership webhook (using
 * overrideAccess); admins can update notes/phone but not name/email/tier
 * (those reflect Stripe state). Hard delete forbidden — preserve audit.
 *
 * Access rules:
 *   - read:   platformOwner sees all; admin sees own tenant only; staff blocked (PII + payment IDs).
 *   - create: always false — the membership webhook uses overrideAccess.
 *   - update: platformOwner or admin within their tenant.
 *   - delete: always false — use status changes for lifecycle, not deletion.
 *
 * Indexes: (tenant, email) unique; (tenant, status) non-unique.
 */
export const Members: CollectionConfig = {
  slug: 'members',
  labels: { singular: 'Member', plural: 'Members' },
  admin: {
    group: 'Membership',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'tier', 'status', 'currentPeriodEnd'],
    description: 'Congregants subscribed to a membership tier.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role === 'admin') {
        const tenant = (user as { tenant?: unknown }).tenant
        return { tenant: { equals: tenant } }
      }
      return false // staff blocked — members hold PII + payment IDs
    },
    create: () => false,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role === 'admin') {
        const tenant = (user as { tenant?: unknown }).tenant
        return { tenant: { equals: tenant } }
      }
      return false
    },
    delete: () => false,
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'tier',
      type: 'relationship',
      relationTo: 'membership-tiers',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'inactive',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'In grace', value: 'grace' },
        { label: 'Inactive', value: 'inactive' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'stripeCustomerId',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'stripeSubscriptionStatus',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'joinedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'currentPeriodEnd',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'canceledAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Admin-only notes; not visible to the member.' },
    },
  ],
  indexes: [
    { fields: ['tenant', 'email'], unique: true },
    { fields: ['tenant', 'status'] },
  ],
  timestamps: true,
}

export default Members
