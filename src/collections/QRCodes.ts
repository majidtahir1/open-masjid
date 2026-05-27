import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { generateQrPng } from '../hooks/generateQrPng'
import { bumpKioskBroadcast } from '../hooks/bumpKioskBroadcast'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export const QRCodes: CollectionConfig = {
  slug: 'qr-codes',
  labels: { singular: 'QR Code', plural: 'QR Codes' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Displays',
    hideAPIURL: true,
    useAsTitle: 'label',
    defaultColumns: ['label', 'targetUrl', 'createdAt'],
    description:
      'Reusable QR codes attached to carousel and sponsor slides. Changes auto-broadcast to all kiosks on save.',
    components: {
      beforeListTable: ['/src/admin/KioskContentBanner#QRCodesBanner'],
    },
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
    afterChange: [generateQrPng, bumpKioskBroadcast],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Code',
          description:
            'The destination URL and a label for finding it later. The PNG image is generated automatically on save.',
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
              label: 'Internal Label',
              admin: { description: 'How you find this QR later. Not shown to congregants.' },
            },
            {
              name: 'targetUrl',
              type: 'text',
              required: true,
              label: 'Target URL',
              admin: { description: 'Where congregants land when they scan.' },
            },
            {
              name: 'generatedImage',
              type: 'upload',
              relationTo: 'media',
              admin: { readOnly: true, description: 'Auto-generated. Refresh after save to see the PNG.' },
            },
          ],
        },
        {
          label: 'Colors',
          description: 'Customize the QR colors. Most masajid leave defaults; adjust to match a slide theme.',
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'fgColor',
                  type: 'text',
                  defaultValue: '#000000',
                  label: 'Foreground',
                  admin: { description: 'Hex format: #RRGGBB', width: '50%' },
                  validate: (v: unknown) =>
                    !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
                },
                {
                  name: 'bgColor',
                  type: 'text',
                  defaultValue: '#FFFFFF',
                  label: 'Background',
                  admin: { description: 'Hex format: #RRGGBB', width: '50%' },
                  validate: (v: unknown) =>
                    !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) =>
          (user as { role?: string } | null)?.role === 'platformOwner',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'platformOwner',
      },
    },
  ],
}
