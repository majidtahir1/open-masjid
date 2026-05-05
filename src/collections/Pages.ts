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
    group: 'Content',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug'],
    description:
      'Static content pages (About, Our Story, Bylaws, etc.). Each page becomes a URL under the tenant\'s site. Use the built-in pages (Home, Events, Prayer Times, Donate) for standard sections.',
    preview: (doc, { req }) => buildPreviewUrl(doc, req, ''),
    livePreview: {
      url: ({ data, req }) => buildLivePreviewUrl(data, req, ''),
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
      name: 'title',
      type: 'text',
      required: true,
      label: 'Page Title',
      admin: {
        description: 'Shown as the page heading and in the browser tab.',
        placeholder: 'About Us',
        components: {
          Field: '/src/fields/TextField#default',
        },
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
      name: 'showInNav',
      type: 'checkbox',
      defaultValue: false,
      label: 'Show in navigation',
      admin: {
        position: 'sidebar',
        description:
          'When enabled, this page appears as a link in the public site header navigation. Only published pages are shown.',
      },
    },
    {
      name: 'navOrder',
      type: 'number',
      label: 'Navigation order',
      admin: {
        position: 'sidebar',
        description:
          'Lower numbers appear first. Pages with the same order (or no order) are sorted alphabetically by title.',
        condition: (data) => Boolean(data?.showInNav),
        step: 1,
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
    // SEO overrides — sidebar group, kept in its own block so it merges
    // cleanly alongside any other parallel field additions to this collection.
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      admin: {
        position: 'sidebar',
        description:
          'Optional overrides for search engine and social-share previews. Leave blank to use sensible defaults derived from the page.',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'SEO Title',
          admin: {
            description:
              'Overrides the page title in the browser tab and social shares. ~60 chars max.',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          label: 'Meta Description',
          admin: {
            description:
              'Used for the meta description and social share previews. ~155 chars max.',
          },
        },
        {
          name: 'ogImage',
          type: 'upload',
          relationTo: 'media',
          label: 'Share Image',
          admin: {
            description:
              'Overrides the default share image (tenant logo). Recommended 1200×630.',
          },
        },
      ],
    },
  ],
}

export default Pages
