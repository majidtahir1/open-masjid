import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

/**
 * Media — tenant-scoped upload collection. Files stored under public/media
 * initially; swap to S3 adapter later without changing field shape.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Media File',
    plural: 'Media Library',
  },
  admin: {
    group: 'Library',
    hideAPIURL: true,
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'alt', 'mimeType', 'tenant'],
    description:
      'Uploaded images and PDFs (event flyers, logos, hero photos). Files live in this tenant\'s library only — other masajid cannot see them.',
  },
  access: {
    read: () => true,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
  },
  upload: {
    staticDir: 'public/media',
    mimeTypes: ['image/*', 'application/pdf'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: undefined,
        position: 'centre',
      },
      {
        name: 'card',
        width: 800,
        height: undefined,
        position: 'centre',
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Alt Text',
      admin: {
        description:
          'Describe the image in one short sentence for screen readers and SEO. Required for every upload.',
        placeholder: 'ICP event flyer for the Evidences of Islam class',
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
        description:
          'Automatically set from your account for non-platform users. Only a Platform Owner can reassign media across tenants.',
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

export default Media
