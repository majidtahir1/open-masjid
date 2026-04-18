import type { CollectionConfig, FieldHook } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

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
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'tag', 'status', 'startDate', 'tenant'],
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      admin: {
        description: 'Auto-generated from title. Edit only if you need a custom URL.',
        position: 'sidebar',
      },
      hooks: {
        beforeValidate: [autoSlug],
      },
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      admin: {
        description: 'Card subtitle — one or two sentences.',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Full event detail page body.',
      },
    },
    {
      name: 'tag',
      type: 'select',
      options: [
        { label: 'Weekly class', value: 'weekly-class' },
        { label: 'Ramadan', value: 'ramadan' },
        { label: 'Eid', value: 'eid' },
        { label: 'Sisters', value: 'sisters' },
        { label: 'Youth', value: 'youth' },
        { label: 'Brothers', value: 'brothers' },
        { label: 'Community', value: 'community' },
      ],
    },
    {
      name: 'audience',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Families', value: 'families' },
        { label: 'Sisters', value: 'sisters' },
        { label: 'Youth', value: 'youth' },
        { label: 'Brothers', value: 'brothers' },
        { label: 'All', value: 'all' },
      ],
    },
    {
      name: 'when',
      type: 'text',
      admin: {
        description:
          'Human-readable cadence for recurring events, e.g. "Mondays after Isha".',
      },
    },
    {
      name: 'startDate',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        description: 'e.g. "Main prayer hall"',
      },
    },
    {
      name: 'address',
      type: 'text',
    },
    {
      name: 'contact',
      type: 'email',
    },
    {
      name: 'displayMode',
      type: 'select',
      required: true,
      defaultValue: 'text',
      options: [
        { label: 'Image (uploaded flyer)', value: 'image' },
        { label: 'Template (auto-generated flyer)', value: 'template' },
        { label: 'Text only', value: 'text' },
      ],
    },
    {
      name: 'flyerImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        condition: (_, siblingData) => siblingData?.displayMode === 'image',
      },
    },
    {
      name: 'templateVariant',
      type: 'select',
      options: [
        { label: 'Default (cream)', value: 'default' },
        { label: 'Navy', value: 'navy' },
        { label: 'Gold', value: 'gold' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData?.displayMode === 'template',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show this event in the homepage hero slider.',
      },
    },
    {
      name: 'heroAccent',
      type: 'select',
      options: [
        { label: 'Cream', value: 'cream' },
        { label: 'Teal', value: 'teal' },
        { label: 'Navy', value: 'navy' },
        { label: 'Gold', value: 'gold' },
      ],
      admin: {
        condition: (_, siblingData) => siblingData?.featured === true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
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
