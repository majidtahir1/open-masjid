import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { bumpKioskBroadcast } from '../hooks/bumpKioskBroadcast'

export const CarouselSlides: CollectionConfig = {
  slug: 'carousel-slides',
  labels: { singular: 'Carousel Slide', plural: 'Carousel Slides' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active', 'priority', 'startDate', 'endDate'],
    description: 'Slides shown in rotation on the kiosk carousel. Changes auto-broadcast to all kiosks on save.',
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
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'details1', type: 'textarea' },
    { name: 'details2', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'qrCode', type: 'relationship', relationTo: 'qr-codes' },
    {
      name: 'backgroundTheme',
      type: 'text',
      defaultValue: 'clean',
      label: 'Background Theme',
      admin: {
        description:
          'Visual background theme. Sourced from islamicThemes.ts — add new themes there without a schema migration.',
        components: {
          Field: '/src/fields/BackgroundThemeField#default',
        },
      },
    },
    { name: 'prayerTimingsEnabled', type: 'checkbox', defaultValue: false },
    {
      name: 'displayDurationMs',
      type: 'number',
      defaultValue: 10000,
      min: 5000,
      max: 60000,
      admin: { description: 'Time on screen in milliseconds (5000–60000).' },
    },
    { name: 'priority', type: 'number', defaultValue: 5, min: 0, max: 10 },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'startDate', type: 'date' },
    { name: 'endDate', type: 'date' },
    { name: 'showInCarousel', type: 'checkbox', defaultValue: true },
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
