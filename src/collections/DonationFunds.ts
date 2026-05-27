import type { CollectionConfig } from 'payload'
import { tenantScopedAccess } from '../access/tenantScoped'
import { denyKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

/**
 * DonationFunds — categories donors can give toward (Sadaqah, Zakat, Building
 * Fund, etc.). One row per fund, scoped to a tenant. Two tenants may each
 * have a fund with the same `slug`; uniqueness is enforced on the
 * composite [tenant, slug] index.
 */
export const DonationFunds: CollectionConfig = {
  slug: 'donation-funds',
  labels: { singular: 'Fund', plural: 'Funds' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Donations',
    useAsTitle: 'name',
    defaultColumns: ['name', 'zakatEligible', 'active', 'sortOrder'],
    description:
      'Categories donors can give toward (Sadaqah, Zakat, Building Fund, etc.).',
    components: {
      beforeList: ['/src/admin/donations/BackToOverview#default'],
      beforeListTable: ['/src/admin/donations/FundsListIntro#default'],
      edit: {
        beforeDocumentControls: ['/src/admin/donations/BackToOverview#default'],
        SaveButton: '/src/admin/donations/FundsSaveButton#default',
      },
    },
  },
  access: {
    read: denyKioskManager(tenantScopedAccess().read),
    create: denyKioskManager(tenantScopedAccess().create),
    update: denyKioskManager(tenantScopedAccess().update),
    delete: denyKioskManager(tenantScopedAccess().delete),
  },
  hooks: {
    beforeChange: [setTenantFromUser],
  },
  fields: [
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: { hidden: true },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Public-facing fund name (e.g. "Sadaqah", "Zakat", "Building Fund").',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'URL-safe identifier, unique within this tenant.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description:
          'Optional description shown beneath the fund name on the donate page.',
      },
    },
    {
      name: 'zakatEligible',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Mark true for funds that accept Zakat (restricted use).' },
    },
    {
      name: 'suggestedAmounts',
      type: 'array',
      labels: { singular: 'Suggested Amount', plural: 'Suggested Amounts' },
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
          min: 1,
          admin: { description: 'Whole-dollar amount shown as a quick-pick.' },
        },
      ],
      admin: {
        description: 'Suggested donation chips (e.g. 25, 50, 100, 250). Optional.',
      },
    },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Inactive funds are hidden from the public donate page.' },
    },
  ],
  indexes: [{ fields: ['tenant', 'slug'], unique: true }],
}

export default DonationFunds
