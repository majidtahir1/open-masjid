import type { CollectionConfig } from 'payload'

import { platformOwnerOnly } from '../access/tenantScoped'

/**
 * Tenants — each masjid (and the ICPC umbrella) is a tenant.
 *
 * Decision: SiteSettings-style fields (contactInfo, socialLinks, etc.) live
 * directly on this collection rather than as a separate Payload global.
 * Payload globals are not natively per-tenant, and storing tenant-scoped
 * config here keeps branding + contact + social in a single editable doc.
 */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'siteType'],
    description:
      'A tenant is a masjid (or umbrella org) served by the platform. Each tenant has its own domain, branding, and content.',
  },
  access: {
    // Only platform owners can create or delete tenants.
    create: platformOwnerOnly,
    delete: platformOwnerOnly,
    // Platform owners see all; tenant users (admin/staff) can read only their own tenant.
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      const tenant = (user as { tenant?: unknown }).tenant
      const tenantId =
        typeof tenant === 'object' && tenant !== null && 'id' in tenant
          ? (tenant as { id: string | number }).id
          : (tenant as string | number | undefined)
      if (!tenantId) return false
      return { id: { equals: tenantId } }
    },
    // Platform owners can update any tenant; admins can update their own.
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role !== 'admin') return false
      const tenant = (user as { tenant?: unknown }).tenant
      const tenantId =
        typeof tenant === 'object' && tenant !== null && 'id' in tenant
          ? (tenant as { id: string | number }).id
          : (tenant as string | number | undefined)
      if (!tenantId) return false
      return { id: { equals: tenantId } }
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name, e.g. "Islamic Center of Prosper"',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Used for subdomain, e.g. icp.openmasjid.app',
      },
    },
    {
      name: 'customDomains',
      type: 'array',
      labels: {
        singular: 'Custom domain',
        plural: 'Custom domains',
      },
      fields: [
        {
          name: 'domain',
          type: 'text',
          required: true,
          admin: {
            description: 'e.g. icprosper.org (no protocol, no trailing slash)',
          },
        },
      ],
    },
    {
      name: 'siteType',
      type: 'select',
      required: true,
      defaultValue: 'masjid',
      options: [
        { label: 'Masjid', value: 'masjid' },
        { label: 'Umbrella organization', value: 'umbrella' },
      ],
    },
    {
      name: 'branding',
      type: 'group',
      label: 'Branding',
      fields: [
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'primaryColor',
          type: 'text',
          admin: {
            description: 'Hex color, e.g. #0F1E4A',
          },
        },
        {
          name: 'secondaryColor',
          type: 'text',
          admin: {
            description: 'Hex color, e.g. #28A0B4',
          },
        },
        {
          name: 'accentColor',
          type: 'text',
          admin: {
            description: 'Hex color, e.g. #F0C88C',
          },
        },
        {
          name: 'displayFont',
          type: 'select',
          defaultValue: 'Fraunces',
          options: [
            { label: 'Fraunces', value: 'Fraunces' },
            { label: 'Playfair Display', value: 'Playfair Display' },
            { label: 'Lora', value: 'Lora' },
          ],
        },
      ],
    },
    {
      name: 'contactInfo',
      type: 'group',
      label: 'Contact info',
      fields: [
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'address', type: 'textarea' },
      ],
    },
    {
      name: 'socialLinks',
      type: 'array',
      labels: {
        singular: 'Social link',
        plural: 'Social links',
      },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'Twitter / X', value: 'twitter' },
            { label: 'LinkedIn', value: 'linkedin' },
          ],
        },
        { name: 'url', type: 'text', required: true },
      ],
    },
    {
      name: 'donationConfig',
      type: 'group',
      label: 'Donation config',
      fields: [
        {
          name: 'mode',
          type: 'select',
          defaultValue: 'external',
          options: [
            { label: 'External link', value: 'external' },
            { label: 'Stripe', value: 'stripe' },
          ],
        },
        {
          name: 'externalUrl',
          type: 'text',
          admin: {
            description: 'e.g. https://launchgood.com/...',
            condition: (_, siblingData) => siblingData?.mode === 'external',
          },
        },
        {
          name: 'stripeAccountId',
          type: 'text',
          admin: {
            condition: (_, siblingData) => siblingData?.mode === 'stripe',
          },
        },
      ],
    },
    {
      name: 'footerTagline',
      type: 'text',
      admin: {
        description: 'Optional tagline shown in the footer.',
      },
    },
  ],
}

export default Tenants
