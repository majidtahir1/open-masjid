import type { CollectionConfig } from 'payload'
import { tenantScopedReadAccess } from '../access/tenantScoped'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'

/**
 * Donations — aggregate-only donation records written by the Stripe Connect
 * webhook. No donor PII is stored here; donor identity always lives in
 * Stripe. Read-only from the admin (the webhook writes via overrideAccess).
 */
export const Donations: CollectionConfig = {
  slug: 'donations',
  labels: { singular: 'Donation', plural: 'All donations' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Donations',
    hidden: hideForKioskManager,
    useAsTitle: 'stripePaymentIntentId',
    defaultColumns: ['createdAt', 'fund', 'amount', 'frequency', 'status'],
    description:
      'Aggregate donation records. No donor PII is stored — donor identity lives in Stripe.',
    components: {
      beforeList: ['/src/admin/donations/BackToOverview#default'],
      edit: {
        beforeDocumentControls: ['/src/admin/donations/BackToOverview#default'],
      },
    },
  },
  access: {
    create: denyKioskManager(() => false),
    update: denyKioskManager(() => false),
    delete: denyKioskManager(() => false),
    read: denyKioskManager(tenantScopedReadAccess()),
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
      name: 'fund',
      type: 'relationship',
      relationTo: 'donation-funds',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Stored in cents; rendered as currency in list and detail views.',
        readOnly: true,
        components: {
          Cell: '/src/admin/donations/AmountCell#default',
          Field: '/src/admin/donations/AmountField#default',
        },
      },
    },
    { name: 'currency', type: 'text', defaultValue: 'usd', admin: { readOnly: true } },
    {
      name: 'frequency',
      type: 'select',
      required: true,
      options: [
        { label: 'One-time', value: 'one_time' },
        { label: 'Monthly', value: 'monthly' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        components: {
          Cell: '/src/admin/donations/StripePaymentIntentCell#default',
          Field: '/src/admin/donations/StripePaymentIntentField#default',
        },
      },
    },
    { name: 'stripeChargeId', type: 'text', admin: { readOnly: true } },
    { name: 'stripeSubscriptionId', type: 'text', admin: { readOnly: true } },
    {
      name: 'stripeAccountId',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
}

export default Donations
