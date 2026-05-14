import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { generateQrPng } from '../hooks/generateQrPng'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export const QRCodes: CollectionConfig = {
  slug: 'qr-codes',
  labels: { singular: 'QR Code', plural: 'QR Codes' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'label',
    defaultColumns: ['label', 'targetUrl', 'createdAt'],
    description: 'Reusable QR codes attached to carousel and sponsor slides.',
    components: {
      edit: {
        beforeDocumentControls: ['/src/components/admin/TenantPushButton#default'],
      },
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
    afterChange: [generateQrPng],
  },
  fields: [
    { name: 'label', type: 'text', required: true, label: 'Internal Label' },
    { name: 'targetUrl', type: 'text', required: true, label: 'Target URL' },
    {
      name: 'fgColor',
      type: 'text',
      defaultValue: '#000000',
      label: 'Foreground Color',
      validate: (v: unknown) =>
        !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
    },
    {
      name: 'bgColor',
      type: 'text',
      defaultValue: '#FFFFFF',
      label: 'Background Color',
      validate: (v: unknown) =>
        !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
    },
    {
      name: 'generatedImage',
      type: 'upload',
      relationTo: 'media',
      admin: { readOnly: true },
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
