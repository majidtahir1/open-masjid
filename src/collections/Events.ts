import type { CollectionConfig, FieldHook } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { withBillingLock } from '../access/billingLocked'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { buildLivePreviewUrl, buildPreviewUrl } from '../lib/previewUrl'

/**
 * Auto-generate a URL-safe slug from the title unless one has been manually
 * provided. Keeps the slug stable after first set.
 */
const slugify = (value: string): string =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const autoSlug: FieldHook = ({ value, data, operation }) => {
  if (value) return value
  if (operation === 'create' && data?.title) {
    return slugify(String(data.title))
  }
  return value
}

export const Events: CollectionConfig = {
  slug: 'events',
  labels: {
    singular: 'Event',
    plural: 'Events',
  },
  admin: {
    group: 'Content',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'tag', '_status', 'startDate', 'featured'],
    description:
      'Classes, programs, and gatherings. Published events appear on the public Events page; featured events also appear in the homepage hero.',
    preview: (doc, { req }) => buildPreviewUrl(doc, req, 'events'),
    livePreview: {
      url: ({ data, req }) => buildLivePreviewUrl(data, req, 'events'),
      breakpoints: [
        { label: 'Mobile', name: 'mobile', width: 375, height: 667 },
        { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
        { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
      ],
    },
  },
  versions: {
    drafts: {
      schedulePublish: true,
    },
  },
  access: {
    read: tenantScopedRead,
    create: withBillingLock(tenantScopedCreate),
    update: withBillingLock(tenantScopedUpdate),
    delete: withBillingLock(tenantScopedDelete),
  },
  hooks: {
    beforeChange: [setTenantFromUser],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          description: 'What this event is and who it\'s for.',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              label: 'Title',
              admin: {
                description: 'The event name as it appears in cards and detail pages.',
                placeholder: 'Evidences of Islam',
                components: {
                  Field: '/src/fields/TextField#default',
                },
              },
            },
            {
              name: 'shortDescription',
              type: 'textarea',
              label: 'Short Description',
              admin: {
                description:
                  'One or two sentences shown on event cards and in the hero. Keep it under ~160 characters.',
                placeholder: 'A weekly class exploring proofs of the faith.',
                components: {
                  Field: '/src/fields/TextareaField#default',
                },
              },
            },
            {
              name: 'description',
              type: 'richText',
              label: 'Full Description',
              admin: {
                description: 'The full body of the event detail page. Supports formatting, links, and lists.',
              },
            },
            {
              name: 'tag',
              type: 'select',
              label: 'Category',
              options: [
                { label: 'Weekly Class', value: 'weekly-class' },
                { label: 'Ramadan', value: 'ramadan' },
                { label: 'Eid', value: 'eid' },
                { label: 'Sisters', value: 'sisters' },
                { label: 'Youth', value: 'youth' },
                { label: 'Brothers', value: 'brothers' },
                { label: 'Community', value: 'community' },
              ],
              admin: {
                description:
                  'A single primary category. Used for filtering on the Events page and for the colored tag on cards.',
                components: {
                  Field: '/src/fields/SelectField#default',
                },
              },
            },
            {
              name: 'audience',
              type: 'select',
              hasMany: true,
              label: 'Audience',
              options: [
                { label: 'Families', value: 'families' },
                { label: 'Sisters', value: 'sisters' },
                { label: 'Youth', value: 'youth' },
                { label: 'Brothers', value: 'brothers' },
                { label: 'All', value: 'all' },
              ],
              admin: {
                description:
                  'Who this event is for — visitors filter by audience. Choose multiple when the event welcomes more than one group.',
              },
            },
          ],
        },
        {
          label: 'Timing & Location',
          description: 'When the event happens and where to find it.',
          fields: [
            {
              name: 'when',
              type: 'text',
              label: 'When (Human-Readable)',
              admin: {
                description:
                  'Free-text cadence for recurring events, e.g. "Mondays after Isha" or "Every Saturday, 10 AM".',
                placeholder: 'Mondays after Isha',
                components: {
                  Field: '/src/fields/TextField#default',
                },
              },
            },
            {
              name: 'startDate',
              type: 'date',
              label: 'Start Date & Time',
              admin: {
                description:
                  'Used for sorting and for hiding past events. Leave blank for always-on recurring classes.',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'endDate',
              type: 'date',
              label: 'End Date & Time',
              admin: {
                description: 'Optional — used when an event spans multiple days.',
                date: { pickerAppearance: 'dayAndTime' },
              },
            },
            {
              name: 'location',
              type: 'text',
              label: 'Location',
              admin: {
                description: 'Where inside/around the masjid the event takes place.',
                placeholder: 'Main prayer hall',
                components: {
                  Field: '/src/fields/TextField#default',
                },
              },
            },
            {
              name: 'address',
              type: 'text',
              label: 'Address',
              admin: {
                description:
                  'Optional — only needed when the event is at a different address than the masjid.',
                components: {
                  Field: '/src/fields/TextField#default',
                },
              },
            },
            {
              name: 'contact',
              type: 'email',
              label: 'Contact Email',
              admin: {
                description: 'Optional — shown on the event detail page for attendee questions.',
                placeholder: 'events@icprosper.org',
                components: {
                  Field: '/src/fields/EmailField#default',
                },
              },
            },
          ],
        },
        {
          label: 'Display',
          description: 'How this event looks in cards, hero, and detail pages.',
          fields: [
            {
              name: 'displayMode',
              type: 'select',
              required: true,
              defaultValue: 'text',
              label: 'Display Mode',
              options: [
                { label: 'Image — Uploaded flyer', value: 'image' },
                { label: 'Template — Auto-generated flyer', value: 'template' },
                { label: 'Text only — No visual', value: 'text' },
              ],
              admin: {
                description:
                  'Choose how this event renders on the Events page. "Image" uses your uploaded flyer; "Template" auto-generates a branded flyer from the title; "Text only" is a compact card.',
                components: {
                  Field: '/src/fields/SelectField#default',
                },
              },
            },
            {
              name: 'flyerImage',
              type: 'upload',
              relationTo: 'media',
              label: 'Flyer Image',
              admin: {
                description:
                  'Shown only when Display Mode is "Image". Upload a ready-made flyer (ideally portrait orientation).',
                condition: (_, siblingData) => siblingData?.displayMode === 'image',
              },
            },
            {
              name: 'templateVariant',
              type: 'select',
              label: 'Template Variant',
              options: [
                { label: 'Default (Cream)', value: 'default' },
                { label: 'Navy', value: 'navy' },
                { label: 'Gold', value: 'gold' },
              ],
              admin: {
                description:
                  'Shown only when Display Mode is "Template". Pick the color scheme for the auto-generated flyer.',
                condition: (_, siblingData) => siblingData?.displayMode === 'template',
                components: {
                  Field: '/src/fields/SelectField#default',
                },
              },
            },
            {
              name: 'featured',
              type: 'checkbox',
              defaultValue: false,
              label: 'Featured on Homepage',
              admin: {
                description:
                  'Tick to include this event in the homepage hero slider. Featured events rotate alongside hero slides.',
                components: {
                  Field: '/src/fields/CheckboxField#default',
                },
              },
            },
            {
              name: 'heroAccent',
              type: 'select',
              label: 'Hero Accent Color',
              options: [
                { label: 'Cream (warm, neutral)', value: 'cream' },
                { label: 'Teal (fresh, calm)', value: 'teal' },
                { label: 'Navy (serious, premium)', value: 'navy' },
                { label: 'Gold (celebratory)', value: 'gold' },
              ],
              admin: {
                description:
                  'Shown only when "Featured on Homepage" is on. Picks the theme for this event\'s slide in the hero.',
                condition: (_, siblingData) => siblingData?.featured === true,
                components: {
                  Field: '/src/fields/SelectField#default',
                },
              },
            },
            // Publish/Draft control is provided by Payload's versions.drafts —
            // no custom `status` field needed. The Publish button lives in the
            // default admin sidebar.
          ],
        },
      ],
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      label: 'URL Slug',
      admin: {
        description:
          'Auto-generated from the title (e.g. "evidences-of-islam"). Edit only if you need a custom URL.',
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [autoSlug],
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      label: 'Tenant',
      admin: {
        position: 'sidebar',
        description: 'Set automatically from your account. Only a Platform Owner can reassign.',
        // Hidden for non-platformOwner users — they can't see or change it.
        condition: (_, __, { user }) => {
          const u = user as { role?: string } | null | undefined
          return u?.role === 'platformOwner'
        },
      },
      access: {
        update: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'platformOwner'
        },
      },
    },
  ],
}

export default Events
