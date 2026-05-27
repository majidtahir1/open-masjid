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
    group: 'Content',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active', 'priority', 'startDate', 'endDate'],
    description:
      'Slides shown in rotation on the kiosk carousel. Changes auto-broadcast to all kiosks on save.',
    components: {
      beforeListTable: ['/src/admin/KioskContentBanner#CarouselSlidesBanner'],
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
          label: 'Content',
          description: 'The text and media this slide shows. Title hides automatically when an image is attached.',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              maxLength: 200,
              admin: { description: 'Hidden on the kiosk when an image is attached below.' },
            },
            {
              name: 'details1',
              type: 'textarea',
              label: 'Detail Line 1',
              admin: { description: 'Optional supporting line shown under the title.' },
            },
            {
              name: 'details2',
              type: 'textarea',
              label: 'Detail Line 2',
              admin: { description: 'Optional second supporting line.' },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  'Optional. Pick from the Media library or upload. When set, this image renders full-screen and the title is hidden.',
              },
            },
            {
              name: 'qrCode',
              type: 'relationship',
              relationTo: 'qr-codes',
              admin: { description: 'Optional. Pick from the QR Code library — congregants can scan.' },
            },
          ],
        },
        {
          label: 'Display',
          description: 'How the slide looks while on screen.',
          fields: [
            {
              name: 'backgroundTheme',
              type: 'text',
              defaultValue: 'clean',
              label: 'Background Theme',
              admin: {
                description:
                  'Visual treatment when no image is attached. Themes are defined in islamicThemes.ts — adding one there does not require a migration.',
                components: { Field: '/src/fields/BackgroundThemeField#default' },
              },
            },
            {
              name: 'prayerTimingsEnabled',
              type: 'checkbox',
              defaultValue: false,
              label: 'Show next-prayer overlay',
              admin: { description: 'Tucks a small next-prayer countdown into the corner of the slide.' },
            },
            {
              name: 'displayDurationMs',
              type: 'number',
              defaultValue: 10000,
              min: 5000,
              max: 60000,
              label: 'Display duration',
              admin: { description: 'Time on screen in milliseconds (5000–60000). 10000 = 10 seconds.' },
            },
          ],
        },
        {
          label: 'Scheduling',
          description: 'Control whether this slide is in rotation and when it appears.',
          fields: [
            {
              name: 'active',
              type: 'checkbox',
              defaultValue: true,
              admin: { description: 'Off → slide is removed from rotation immediately on save.' },
            },
            {
              name: 'showInCarousel',
              type: 'checkbox',
              defaultValue: true,
              admin: { description: 'Off → keep the record but hide it from kiosks.' },
            },
            {
              name: 'priority',
              type: 'number',
              defaultValue: 5,
              min: 0,
              max: 10,
              admin: { description: 'Higher numbers appear earlier in the rotation (0–10).' },
            },
            {
              name: 'startDate',
              type: 'date',
              admin: { description: 'Optional. Slide stays hidden until this date.' },
            },
            {
              name: 'endDate',
              type: 'date',
              admin: { description: 'Optional. Slide auto-hides after this date.' },
            },
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
