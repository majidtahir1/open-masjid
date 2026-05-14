import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

export const CarouselSlides: CollectionConfig = {
  slug: 'carousel-slides',
  labels: { singular: 'Carousel Slide', plural: 'Carousel Slides' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active', 'priority', 'startDate', 'endDate'],
    description: 'Slides shown in rotation on the kiosk carousel.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'details1', type: 'textarea' },
    { name: 'details2', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'qrCode', type: 'relationship', relationTo: 'qr-codes' },
    {
      name: 'backgroundTheme',
      type: 'select',
      defaultValue: 'clean',
      options: [
        { label: 'Classic Clean', value: 'clean' },
        { label: 'Subtle Heritage', value: 'subtle-texture' },
        { label: 'Teal Corners', value: 'teal-corners' },
        { label: 'Navy Accents', value: 'navy-accents' },
        { label: 'Full Ambiance', value: 'full-ambiance' },
        { label: 'Ornate Frame', value: 'ornate-frame' },
        { label: 'Desert Oasis', value: 'desert-oasis' },
        { label: 'Islamic Pattern', value: 'islamic_pattern' },
        { label: 'Pink Tech', value: 'pink-tech' },
        { label: 'Blue Tech', value: 'blue-tech' },
        { label: 'Chess Theme', value: 'chess-theme' },
        { label: 'Quran Theme', value: 'quran-theme' },
        { label: 'Ramadan', value: 'ramadan' },
      ],
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
