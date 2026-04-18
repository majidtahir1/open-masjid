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
    singular: 'Hero Slide',
    plural: 'Hero Slides',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'accent', 'active', 'sortOrder'],
    description:
      'Slides for the homepage hero slider. Use these for mission statements, donation pushes, or general announcements. Featured events from the Events collection are auto-added at render time.',
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
      type: 'collapsible',
      label: 'Slide Content',
      admin: {
        description: 'The text shown on the slide. Keep the title punchy (under ~8 words).',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'eyebrow',
          type: 'text',
          label: 'Eyebrow Text',
          admin: {
            description:
              'Small label above the headline, e.g. "Islamic Center of Prosper". Optional — omit to save vertical space.',
            placeholder: 'Islamic Center of Prosper',
          },
        },
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Headline',
          admin: {
            description: 'The main line visitors see. Short and action-oriented.',
            placeholder: 'A community rooted in service',
          },
        },
        {
          name: 'body',
          type: 'textarea',
          label: 'Body Copy',
          admin: {
            description: 'One or two sentences supporting the headline.',
          },
        },
        {
          name: 'meta',
          type: 'text',
          label: 'Footer Note',
          admin: {
            description:
              'Optional small line below the CTAs, e.g. "Monthly recurring available".',
          },
        },
      ],
    },
    {
      name: 'accent',
      type: 'select',
      required: true,
      defaultValue: 'cream',
      label: 'Slide Theme',
      options: [
        { label: 'Cream — warm, neutral (default welcome slides)', value: 'cream' },
        { label: 'Teal — fresh, calm (mission / about)', value: 'teal' },
        { label: 'Navy — serious, premium (flagship programs)', value: 'navy' },
        { label: 'Gold — celebratory (Eid, fundraisers, milestones)', value: 'gold' },
      ],
      admin: {
        description:
          'Controls the background color and typography contrast for this slide. Rotate themes across slides so adjacent slides look distinct.',
      },
    },
    {
      name: 'ctas',
      type: 'array',
      label: 'Call-to-Action Buttons',
      labels: { singular: 'CTA', plural: 'CTAs' },
      admin: {
        description:
          'Up to two buttons per slide. Mark one as Primary (filled) and leave the other secondary (outlined).',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'Button Label',
          admin: { placeholder: 'Donate' },
        },
        {
          name: 'linkType',
          type: 'select',
          required: true,
          defaultValue: 'url',
          label: 'Link Type',
          options: [
            { label: 'Internal page', value: 'page' },
            { label: 'External URL', value: 'url' },
          ],
          admin: {
            description:
              'Use "Internal page" for site pages (faster, handles branding). Use "External URL" for LaunchGood, forms, etc.',
          },
        },
        {
          name: 'page',
          type: 'select',
          label: 'Page',
          options: [
            { label: 'Home', value: '/' },
            { label: 'Events', value: '/events' },
            { label: 'Prayer Times', value: '/prayer-times' },
            { label: 'Donate', value: '/donate' },
            { label: 'About', value: '/about' },
          ],
          admin: {
            description: 'Shown only when Link Type is "Internal page".',
            condition: (_, siblingData) => siblingData?.linkType === 'page',
          },
        },
        {
          name: 'url',
          type: 'text',
          label: 'External URL',
          admin: {
            description:
              'Shown only when Link Type is "External URL". Include https://',
            placeholder: 'https://launchgood.com/...',
            condition: (_, siblingData) => siblingData?.linkType === 'url',
          },
        },
        {
          name: 'icon',
          type: 'text',
          label: 'Icon Name',
          admin: {
            description:
              'Optional. Name of a Lucide icon (kebab-case), e.g. "hand-heart". See lucide.dev for the full list.',
            placeholder: 'hand-heart',
          },
        },
        {
          name: 'primary',
          type: 'checkbox',
          defaultValue: false,
          label: 'Primary Button',
          admin: {
            description:
              'On = filled/branded button. Off = outlined secondary button. Mark one CTA per slide as primary.',
          },
        },
      ],
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      label: 'Sort Order',
      admin: {
        description: 'Lower numbers appear first in the slider.',
        position: 'sidebar',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Active',
      admin: {
        description: 'Uncheck to hide this slide without deleting it.',
        position: 'sidebar',
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
