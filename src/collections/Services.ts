import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { withBillingLock } from '../access/billingLocked'
import { denyKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { validateLucideIcon } from '../lib/validateLucideIcon'

export const Services: CollectionConfig = {
  slug: 'services',
  labels: {
    singular: 'Service',
    plural: 'Services',
  },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Content',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'icon', 'sortOrder'],
    description:
      'Ongoing services the masjid offers (counseling, new-Muslim support, funeral services, etc.). These appear as icon cards on the homepage Services grid.',
  },
  defaultSort: 'sortOrder',
  access: {
    read: denyKioskManager(tenantScopedRead),
    create: denyKioskManager(withBillingLock(tenantScopedCreate)),
    update: denyKioskManager(withBillingLock(tenantScopedUpdate)),
    delete: denyKioskManager(withBillingLock(tenantScopedDelete)),
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
      label: 'Icon',
      admin: {
        description: 'Pick an icon that represents this service.',
        components: {
          Field: '/src/fields/IconPickerField#default',
        },
      },
      validate: (value: unknown) => validateLucideIcon(value),
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
  versions: {
    drafts: true,
  },
}

export default Services
