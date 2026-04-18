import type { CollectionConfig, FieldHook } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

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

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: {
    singular: 'Page',
    plural: 'Pages',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug'],
    description:
      'Static content pages (About, Our Story, Bylaws, etc.). Each page becomes a URL under the tenant\'s site. Use the built-in pages (Home, Events, Prayer Times, Donate) for standard sections.',
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
      label: 'Page Title',
      admin: {
        description: 'Shown as the page heading and in the browser tab.',
        placeholder: 'About Us',
      },
    },
    {
      name: 'slug',
      type: 'text',
      index: true,
      label: 'URL Slug',
      admin: {
        description:
          'Auto-generated from the title. Becomes the URL path, e.g. "about" renders at /about. Lowercase letters, numbers, and dashes only.',
        position: 'sidebar',
        placeholder: 'about',
      },
      hooks: {
        beforeValidate: [autoSlug],
      },
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Content',
      admin: {
        description:
          'The body of the page. Supports headings, lists, links, and inline images.',
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

export default Pages
