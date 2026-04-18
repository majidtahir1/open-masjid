import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

export const HeroSlides: CollectionConfig = {
  slug: 'hero-slides',
  labels: {
    singular: 'Hero slide',
    plural: 'Hero slides',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'accent', 'active', 'sortOrder'],
    description:
      'Slides for the homepage hero. Featured events are auto-included at render time.',
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
      name: 'eyebrow',
      type: 'text',
      admin: {
        description: 'Small label above the title, e.g. "Islamic Center of Prosper".',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
    },
    {
      name: 'accent',
      type: 'select',
      required: true,
      defaultValue: 'cream',
      options: [
        { label: 'Cream', value: 'cream' },
        { label: 'Teal', value: 'teal' },
        { label: 'Navy', value: 'navy' },
        { label: 'Gold', value: 'gold' },
      ],
    },
    {
      name: 'ctas',
      type: 'array',
      labels: { singular: 'CTA', plural: 'CTAs' },
      admin: {
        description: 'Call-to-action buttons shown on the slide.',
      },
      fields: [
        { name: 'label', type: 'text', required: true },
        {
          name: 'linkType',
          type: 'select',
          required: true,
          defaultValue: 'url',
          options: [
            { label: 'Internal page', value: 'page' },
            { label: 'External URL', value: 'url' },
          ],
        },
        {
          name: 'page',
          type: 'select',
          options: [
            { label: 'Home', value: '/' },
            { label: 'Events', value: '/events' },
            { label: 'Prayer times', value: '/prayer-times' },
            { label: 'Donate', value: '/donate' },
            { label: 'About', value: '/about' },
          ],
          admin: {
            condition: (_, siblingData) => siblingData?.linkType === 'page',
          },
        },
        {
          name: 'url',
          type: 'text',
          admin: {
            condition: (_, siblingData) => siblingData?.linkType === 'url',
          },
        },
        {
          name: 'icon',
          type: 'text',
          admin: {
            description: 'Lucide icon name, e.g. "hand-heart".',
          },
        },
        {
          name: 'primary',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Render as the primary (filled) button.',
          },
        },
      ],
    },
    {
      name: 'meta',
      type: 'text',
      admin: {
        description: 'Optional footer note, e.g. "Monthly recurring available".',
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Lower numbers appear first.',
        position: 'sidebar',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
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

export default HeroSlides
