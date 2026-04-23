import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: {
    singular: 'Announcement',
    plural: 'Announcements',
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'priority', 'active', 'expiresAt'],
    description:
      'Short-lived notices shown at the top of the public site (closures, schedule changes, reminders). Use Events for programs; use Announcements for quick updates.',
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
      label: 'Title',
      admin: {
        description: 'A short headline, e.g. "Jumu\'ah moved to 1:30 PM this week".',
        components: {
          Field: '/src/fields/TextField#default',
        },
      },
    },
    {
      name: 'body',
      type: 'richText',
      label: 'Body',
      admin: {
        description: 'Supporting detail shown when the announcement is expanded.',
      },
    },
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'normal',
      label: 'Priority',
      options: [
        { label: 'Normal', value: 'normal' },
        { label: 'High (prominent styling)', value: 'high' },
      ],
      admin: {
        description:
          'High priority renders with stronger visual emphasis (e.g. bolder banner). Use sparingly.',
        position: 'sidebar',
        components: {
          Field: '/src/fields/SelectField#default',
        },
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Active',
      admin: {
        description:
          'Manual on/off switch. Turn off to hide immediately. Prefer this for "show, then hide on my schedule"; use Expires At for automatic hiding.',
        position: 'sidebar',
        components: {
          Field: '/src/fields/CheckboxField#default',
        },
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Expires At',
      admin: {
        description:
          'Optional automatic hide date. Once past this date, the announcement stops rendering even if Active is on. Leave blank for evergreen notices.',
        date: { pickerAppearance: 'dayAndTime' },
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

export default Announcements
