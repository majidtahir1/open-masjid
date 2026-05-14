import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { pairKioskOnSave } from '../hooks/pairKioskOnSave'

export const Kiosks: CollectionConfig = {
  slug: 'kiosks',
  labels: { singular: 'Kiosk', plural: 'Kiosks' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'location', 'status', 'lastSeenAt'],
    description:
      'Physical display screens. Pair a new kiosk by typing the code shown on its screen into the Pairing Code field below.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser, pairKioskOnSave],
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Display Name' },
    { name: 'location', type: 'text', label: 'Location (e.g. Lobby, Hall)' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'UNPAIRED',
      options: [
        { label: 'Unpaired', value: 'UNPAIRED' },
        { label: 'Online', value: 'ONLINE' },
        { label: 'Offline', value: 'OFFLINE' },
        { label: 'Maintenance', value: 'MAINTENANCE' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'pairingCode',
      type: 'text',
      label: 'Pairing Code',
      admin: {
        description:
          'Type the 6-character code shown on the kiosk screen here, then save. Format: ABC-123.',
        placeholder: 'ABC-123',
      },
    },
    { name: 'deviceId', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'secretHash', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'pairingCodeExpiresAt', type: 'date', admin: { readOnly: true, hidden: true } },
    { name: 'lastSeenAt', type: 'date', admin: { readOnly: true } },
    { name: 'lastSeenIp', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'userAgent', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'kioskPushAt', type: 'date', admin: { readOnly: true, hidden: true } },
    {
      name: 'overrideEnabled',
      type: 'checkbox',
      defaultValue: false,
      label: 'Override Slide Playlist',
      admin: {
        description: 'When on, this kiosk shows only the slides selected below.',
      },
    },
    // TODO(Task 7): Restore slideOverrides once carousel-slides, sponsor-slides,
    // and weekly-events-slides collections are registered. Payload validates
    // relationship slugs at config-sanitize time (runtime), so this field cannot
    // be active until those collections exist — even `as any` bypasses only tsc,
    // not Payload's own InvalidFieldRelationship guard.
    // {
    //   name: 'slideOverrides',
    //   type: 'relationship',
    //   relationTo: ['carousel-slides', 'sponsor-slides', 'weekly-events-slides'] as any,
    //   hasMany: true,
    //   admin: {
    //     condition: (data) => Boolean(data?.overrideEnabled),
    //     description: 'Specific slides this kiosk should show (when override is on).',
    //   },
    // },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      label: 'Tenant',
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
