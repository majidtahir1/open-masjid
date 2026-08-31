import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { withBillingLock } from '../access/billingLocked'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
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
    group: 'Website',
    hidden: hideForKioskManager,
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
      name: 'linkType',
      type: 'select',
      defaultValue: 'none',
      label: 'Link Type',
      options: [
        { label: 'No link', value: 'none' },
        { label: 'Site page', value: 'page' },
        { label: 'External URL', value: 'url' },
      ],
      admin: {
        description:
          'Optionally render a "Learn more" link on this service\'s card. Link to a page on this site or to an external URL.',
        components: {
          Field: '/src/fields/SelectField#default',
        },
      },
    },
    {
      name: 'linkPage',
      type: 'relationship',
      relationTo: 'pages',
      label: 'Link Page',
      admin: {
        description:
          'The site page the "Learn more" link on this service\'s card points to.',
        condition: (_, siblingData) => siblingData?.linkType === 'page',
      },
    },
    {
      name: 'linkUrl',
      type: 'text',
      label: 'Link URL',
      admin: {
        description:
          'The URL the "Learn more" link on this service\'s card points to. Use a full https:// URL for external sites, or a root-relative path (e.g. /programs) for a page on this site.',
        placeholder: 'https://example.org/program',
        condition: (_, siblingData) => siblingData?.linkType === 'url',
        components: {
          Field: '/src/fields/TextField#default',
        },
      },
      // Reject javascript:/data:/protocol-relative and other ambiguous
      // schemes — a stored link must never execute script in the site origin.
      validate: (value: unknown) => {
        if (value == null || value === '') return true
        const url = String(value).trim()
        if (/^https?:\/\//i.test(url)) return true
        if (url.startsWith('/') && !url.startsWith('//')) return true
        return 'Must be a full http(s):// URL or a root-relative path starting with "/".'
      },
    },
    {
      name: 'linkLabel',
      type: 'text',
      label: 'Link Label',
      admin: {
        description:
          'Text for the link on this service\'s card, e.g. "Explore programs". Leave blank for "Learn more".',
        placeholder: 'Learn more',
        condition: (_, siblingData) =>
          siblingData?.linkType === 'page' || siblingData?.linkType === 'url',
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
  versions: {
    drafts: true,
  },
}

export default Services
