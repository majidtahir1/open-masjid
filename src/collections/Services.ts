import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

export const Services: CollectionConfig = {
  slug: 'services',
  labels: {
    singular: 'Service',
    plural: 'Services',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'icon', 'sortOrder'],
    description:
      'Ongoing services the masjid offers (counseling, new-Muslim support, funeral services, etc.). These appear as icon cards on the homepage Services grid.',
  },
  defaultSort: 'sortOrder',
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
        description: 'The service name, e.g. "New Muslims (Ansar)" or "Funeral Services".',
        placeholder: 'New Muslims (Ansar)',
        components: {
          Field: '/src/fields/TextField#default',
        },
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
      admin: {
        description: 'A short sentence or two explaining what this service offers.',
        components: {
          Field: '/src/fields/TextareaField#default',
        },
      },
    },
    {
      name: 'icon',
      type: 'text',
      required: true,
      label: 'Icon Name',
      admin: {
        description:
          'Name of a Lucide icon (kebab-case), e.g. "hand-heart", "book-open", "users". Browse lucide.dev for the full list.',
        placeholder: 'hand-heart',
        components: {
          Field: '/src/fields/TextField#default',
        },
      },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      label: 'Sort Order',
      admin: {
        description: 'Lower numbers appear first in the grid.',
        position: 'sidebar',
        components: {
          Field: '/src/fields/NumberField#default',
        },
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

export default Services
