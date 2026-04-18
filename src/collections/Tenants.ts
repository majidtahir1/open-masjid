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
  labels: {
    singular: 'Tenant',
    plural: 'Tenants',
  },
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
      type: 'tabs',
      tabs: [
        {
          label: 'Identity',
          description: 'How this tenant is named and what type of site it runs.',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              label: 'Display Name',
              admin: {
                description:
                  'Public-facing name shown in the site header, footer, and emails, e.g. "Islamic Center of Prosper".',
                placeholder: 'Islamic Center of Prosper',
              },
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              unique: true,
              index: true,
              label: 'URL Slug',
              admin: {
                description:
                  'Short identifier used for the platform subdomain (e.g. "icp" becomes icp.openmasjid.app). Lowercase letters, numbers, and dashes only. Avoid changing after launch.',
                placeholder: 'icp',
              },
            },
            {
              name: 'siteType',
              type: 'select',
              required: true,
              defaultValue: 'masjid',
              label: 'Site Type',
              options: [
                { label: 'Masjid', value: 'masjid' },
                { label: 'Umbrella Organization', value: 'umbrella' },
              ],
              admin: {
                description:
                  'Choose "Masjid" for a single-community site, or "Umbrella Organization" for a parent org that groups multiple masajid.',
              },
            },
          ],
        },
        {
          label: 'Domains',
          description:
            'Custom domains owned by this masjid. The platform subdomain (from slug) always works — custom domains are optional.',
          fields: [
            {
              name: 'customDomains',
              type: 'array',
              label: 'Custom Domains',
              labels: {
                singular: 'Custom Domain',
                plural: 'Custom Domains',
              },
              admin: {
                description:
                  'Add each custom domain the masjid owns (both with and without www if applicable). Visitors reaching these domains will see this tenant\'s public site.',
              },
              fields: [
                {
                  name: 'domain',
                  type: 'text',
                  required: true,
                  label: 'Domain',
                  admin: {
                    description:
                      'Hostname only — no https:// and no trailing slash. Example: icprosper.org',
                    placeholder: 'icprosper.org',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Branding',
          description:
            'Logo, colors, and typography. These values drive the design tokens used across the public site.',
          fields: [
            {
              name: 'branding',
              type: 'group',
              label: 'Branding',
              admin: {
                description:
                  'Upload a logo and set brand colors. Hover/pressed/soft shades are derived automatically — you only choose three colors.',
              },
              fields: [
                {
                  name: 'logo',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Logo',
                  admin: {
                    description:
                      'Primary logo shown in the site header and admin panel. Prefer a transparent PNG or SVG.',
                  },
                },
                {
                  name: 'primaryColor',
                  type: 'text',
                  label: 'Primary Color',
                  admin: {
                    description:
                      'Main brand color — used for buttons, links, and headings. Hex value, e.g. #0F1E4A (navy).',
                    placeholder: '#0F1E4A',
                  },
                },
                {
                  name: 'secondaryColor',
                  type: 'text',
                  label: 'Secondary Color',
                  admin: {
                    description:
                      'Supporting accent — used in highlights and secondary UI. Hex value, e.g. #28A0B4 (teal).',
                    placeholder: '#28A0B4',
                  },
                },
                {
                  name: 'accentColor',
                  type: 'text',
                  label: 'Accent Color',
                  admin: {
                    description:
                      'Warm accent — used sparingly on badges and devotional elements. Hex value, e.g. #F0C88C (gold).',
                    placeholder: '#F0C88C',
                  },
                },
                {
                  name: 'displayFont',
                  type: 'select',
                  defaultValue: 'Fraunces',
                  label: 'Display Font',
                  options: [
                    { label: 'Fraunces (warm serif)', value: 'Fraunces' },
                    { label: 'Playfair Display (editorial serif)', value: 'Playfair Display' },
                    { label: 'Lora (readable serif)', value: 'Lora' },
                  ],
                  admin: {
                    description:
                      'Headline font. Body text and Arabic fonts are fixed platform-wide for consistency.',
                  },
                },
              ],
            },
          ],
        },
        {
          label: 'Contact',
          description: 'Contact information and social links shown in the footer and About pages.',
          fields: [
            {
              name: 'contactInfo',
              type: 'group',
              label: 'Contact Info',
              admin: {
                description: 'Shown in the site footer and the About page.',
              },
              fields: [
                {
                  name: 'phone',
                  type: 'text',
                  label: 'Phone',
                  admin: { placeholder: '(555) 555-5555' },
                },
                {
                  name: 'email',
                  type: 'text',
                  label: 'Email',
                  admin: { placeholder: 'info@icprosper.org' },
                },
                {
                  name: 'address',
                  type: 'textarea',
                  label: 'Address',
                  admin: {
                    description: 'Street address, one line per part (street, city/state/zip).',
                  },
                },
              ],
            },
            {
              name: 'socialLinks',
              type: 'array',
              label: 'Social Links',
              labels: {
                singular: 'Social Link',
                plural: 'Social Links',
              },
              admin: {
                description:
                  'Links to the masjid\'s social accounts. Rendered as icons in the footer.',
              },
              fields: [
                {
                  name: 'platform',
                  type: 'select',
                  required: true,
                  label: 'Platform',
                  options: [
                    { label: 'Facebook', value: 'facebook' },
                    { label: 'Instagram', value: 'instagram' },
                    { label: 'YouTube', value: 'youtube' },
                    { label: 'Twitter / X', value: 'twitter' },
                    { label: 'LinkedIn', value: 'linkedin' },
                  ],
                },
                {
                  name: 'url',
                  type: 'text',
                  required: true,
                  label: 'URL',
                  admin: {
                    description: 'Full URL including https://',
                    placeholder: 'https://instagram.com/your-handle',
                  },
                },
              ],
            },
            {
              name: 'footerTagline',
              type: 'text',
              label: 'Footer Tagline',
              admin: {
                description:
                  'Optional short phrase shown beneath the logo in the footer, e.g. "Serving Prosper since 2010".',
                placeholder: 'A community rooted in service.',
              },
            },
          ],
        },
        {
          label: 'Donations',
          description: 'How donations are collected for this masjid.',
          fields: [
            {
              name: 'donationConfig',
              type: 'group',
              label: 'Donation Config',
              admin: {
                description:
                  'Choose how the "Donate" button behaves. Start with an external link; Stripe integration is planned for a future release.',
              },
              fields: [
                {
                  name: 'mode',
                  type: 'select',
                  defaultValue: 'external',
                  label: 'Donation Mode',
                  options: [
                    { label: 'External link (LaunchGood, PayPal, etc.)', value: 'external' },
                    { label: 'Stripe on-site', value: 'stripe' },
                  ],
                  admin: {
                    description:
                      'External link is recommended for MVP. Stripe mode will be enabled in a future release.',
                  },
                },
                {
                  name: 'externalUrl',
                  type: 'text',
                  label: 'External Donation URL',
                  admin: {
                    description:
                      'Shown only when Donation Mode is "External link". Full URL to your existing donation page.',
                    placeholder: 'https://launchgood.com/...',
                    condition: (_, siblingData) => siblingData?.mode === 'external',
                  },
                },
                {
                  name: 'stripeAccountId',
                  type: 'text',
                  label: 'Stripe Account ID',
                  admin: {
                    description:
                      'Shown only when Donation Mode is "Stripe on-site". Connected Stripe account ID (acct_...).',
                    placeholder: 'acct_1AbCdEfGhIjKlMnO',
                    condition: (_, siblingData) => siblingData?.mode === 'stripe',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

export default Tenants
