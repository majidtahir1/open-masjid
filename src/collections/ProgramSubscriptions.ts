import type { CollectionConfig } from 'payload'
import { denyKioskManager } from '../access/kioskRoles'

/**
 * ProgramSubscriptions — the family/tuition record. One row per family
 * (guardian email) per program, holding the recurring Stripe subscription
 * that bills tuition. Created and updated by the tuition webhook (using
 * overrideAccess); admins can read within their tenant but not create or
 * delete (those reflect Stripe state). Hard delete forbidden — preserve audit.
 *
 * Access rules (mirrors Members):
 *   - read:   platformOwner sees all; admin sees own tenant only; staff blocked (PII + payment IDs).
 *   - create: always false — the tuition webhook uses overrideAccess.
 *   - update: platformOwner or admin within their tenant.
 *   - delete: always false — use status changes for lifecycle, not deletion.
 *
 * Indexes: (tenant, stripeSubscriptionId).
 */
export const ProgramSubscriptions: CollectionConfig = {
  slug: 'program-subscriptions',
  labels: { singular: 'Program subscription', plural: 'Program subscriptions' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Programs',
    hidden: true,
    useAsTitle: 'guardianEmail',
    defaultColumns: ['guardianEmail', 'program', 'status', 'currentPeriodEnd'],
    description: 'Family tuition subscriptions billed via Stripe Connect.',
  },
  access: {
    read: denyKioskManager(({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role === 'admin') {
        const tenant = (user as { tenant?: unknown }).tenant
        return { tenant: { equals: tenant } }
      }
      return false // staff blocked — holds PII + payment IDs
    }),
    create: denyKioskManager(() => false),
    update: denyKioskManager(({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role === 'admin') {
        const tenant = (user as { tenant?: unknown }).tenant
        return { tenant: { equals: tenant } }
      }
      return false
    }),
    delete: denyKioskManager(() => false),
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
      name: 'guardianEmail',
      type: 'text',
      required: true,
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'program',
      type: 'relationship',
      relationTo: 'terms',
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
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Past due', value: 'past_due' },
        { label: 'Canceled', value: 'canceled' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'currentPeriodEnd',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'createdAt',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
  indexes: [{ fields: ['tenant', 'stripeSubscriptionId'] }],
  timestamps: true,
}

export default ProgramSubscriptions
