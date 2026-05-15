import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { bumpKioskBroadcast } from '../hooks/bumpKioskBroadcast'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export const SponsorSlides: CollectionConfig = {
  slug: 'sponsor-slides',
  labels: { singular: 'Sponsor Slide', plural: 'Sponsor Slides' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active', 'priority', 'layoutTemplate'],
    description:
      'Advertiser / sponsor slides shown on the kiosk carousel. Changes auto-broadcast to all kiosks on save.',
    components: {
      beforeListTable: ['/src/admin/KioskContentBanner#SponsorSlidesBanner'],
    },
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
    afterChange: [bumpKioskBroadcast],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Sponsor',
          description: 'Who the sponsor is and what they want to say.',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              maxLength: 200,
              label: 'Sponsor / Company Name',
            },
            {
              name: 'tagline',
              type: 'text',
              maxLength: 300,
              admin: { description: 'Short subtitle shown below the company name.' },
            },
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
              admin: { description: 'Sponsor logo. Transparent PNG recommended.' },
            },
            {
              type: 'collapsible',
              label: 'Detail Lines',
              admin: { initCollapsed: true, description: 'Optional supporting lines (address, hours, slogan).' },
              fields: [
                { name: 'details1', type: 'text', maxLength: 300, label: 'Detail Line 1' },
                { name: 'details2', type: 'text', maxLength: 300, label: 'Detail Line 2' },
                { name: 'details3', type: 'text', maxLength: 300, label: 'Detail Line 3' },
              ],
            },
            {
              type: 'collapsible',
              label: 'Contact Info',
              admin: { initCollapsed: true, description: 'Optional contact info shown on the slide.' },
              fields: [
                { name: 'contactPhone', type: 'text', maxLength: 50, label: 'Phone' },
                { name: 'contactAddress', type: 'text', maxLength: 300, label: 'Address' },
                { name: 'contactWebsite', type: 'text', maxLength: 200, label: 'Website' },
              ],
            },
            {
              name: 'ctaText',
              type: 'text',
              maxLength: 100,
              label: 'Call to action',
              admin: { description: 'Short button-like text, e.g. "Visit us" or "Order online".' },
            },
            {
              name: 'qrCode',
              type: 'relationship',
              relationTo: 'qr-codes',
              admin: { description: 'Optional. Pick from the QR Code library.' },
            },
          ],
        },
        {
          label: 'Layout & Brand',
          description: 'Pick a layout template and the sponsor brand colors.',
          fields: [
            {
              name: 'layoutTemplate',
              type: 'select',
              required: true,
              defaultValue: 'logo-left',
              admin: { description: 'Layout for the slide. Each renders the same fields differently.' },
              options: [
                { label: 'Logo Left', value: 'logo-left' },
                { label: 'Logo Top Centered', value: 'logo-top-centered' },
                { label: 'Logo Dominant', value: 'logo-dominant' },
                { label: 'Split Screen', value: 'split-screen' },
              ],
            },
            {
              name: 'backgroundStyle',
              type: 'select',
              defaultValue: 'gradient',
              admin: { description: 'How the slide background is filled.' },
              options: [
                { label: 'Gradient', value: 'gradient' },
                { label: 'Solid', value: 'solid' },
                { label: 'Brand Primary', value: 'brand-primary' },
                { label: 'Brand Secondary', value: 'brand-secondary' },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'brandColorPrimary',
                  type: 'text',
                  label: 'Primary',
                  admin: { description: 'Hex format: #RRGGBB', width: '50%' },
                  validate: (v: unknown) =>
                    !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
                },
                {
                  name: 'brandColorSecondary',
                  type: 'text',
                  label: 'Secondary',
                  admin: { description: 'Hex format: #RRGGBB', width: '50%' },
                  validate: (v: unknown) =>
                    !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
                },
              ],
            },
          ],
        },
        {
          label: 'Scheduling',
          description: 'Control whether this sponsor slide is in rotation and when it appears.',
          fields: [
            { name: 'active', type: 'checkbox', defaultValue: true },
            {
              name: 'priority',
              type: 'number',
              defaultValue: 5,
              min: 0,
              max: 10,
              admin: { description: 'Higher numbers appear earlier in the rotation (0–10).' },
            },
            {
              name: 'displayDurationMs',
              type: 'number',
              defaultValue: 10000,
              min: 5000,
              max: 60000,
              label: 'Display duration',
              admin: { description: 'Time on screen in milliseconds (5000–60000).' },
            },
            { name: 'startDate', type: 'date', admin: { description: 'Optional.' } },
            { name: 'endDate', type: 'date', admin: { description: 'Optional.' } },
          ],
        },
      ],
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) =>
          (user as { role?: string } | null)?.role === 'platformOwner',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'platformOwner',
      },
    },
  ],
}
