import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

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
    description: 'Advertiser / sponsor slides shown on the kiosk carousel.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200, label: 'Sponsor / Company Name' },
    { name: 'tagline', type: 'text', maxLength: 300 },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'brandColorPrimary',
      type: 'text',
      validate: (v: unknown) =>
        !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
    },
    {
      name: 'brandColorSecondary',
      type: 'text',
      validate: (v: unknown) =>
        !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
    },
    {
      name: 'backgroundStyle',
      type: 'select',
      defaultValue: 'gradient',
      options: [
        { label: 'Gradient', value: 'gradient' },
        { label: 'Solid', value: 'solid' },
        { label: 'Brand Primary', value: 'brand-primary' },
        { label: 'Brand Secondary', value: 'brand-secondary' },
      ],
    },
    {
      name: 'layoutTemplate',
      type: 'select',
      required: true,
      defaultValue: 'logo-left',
      options: [
        { label: 'Logo Left', value: 'logo-left' },
        { label: 'Logo Top Centered', value: 'logo-top-centered' },
        { label: 'Logo Dominant', value: 'logo-dominant' },
        { label: 'Split Screen', value: 'split-screen' },
      ],
    },
    { name: 'details1', type: 'text', maxLength: 300 },
    { name: 'details2', type: 'text', maxLength: 300 },
    { name: 'details3', type: 'text', maxLength: 300 },
    { name: 'contactPhone', type: 'text', maxLength: 50 },
    { name: 'contactAddress', type: 'text', maxLength: 300 },
    { name: 'contactWebsite', type: 'text', maxLength: 200 },
    // TODO(Task 8): Restore qrCode field once the qr-codes collection exists.
    // { name: 'qrCode', type: 'relationship', relationTo: 'qr-codes' },
    { name: 'ctaText', type: 'text', maxLength: 100 },
    { name: 'displayDurationMs', type: 'number', defaultValue: 10000, min: 5000, max: 60000 },
    { name: 'priority', type: 'number', defaultValue: 5, min: 0, max: 10 },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'startDate', type: 'date' },
    { name: 'endDate', type: 'date' },
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
