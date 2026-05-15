import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { bumpKioskBroadcast } from '../hooks/bumpKioskBroadcast'

export const WeeklyEventsSlides: CollectionConfig = {
  slug: 'weekly-events-slides',
  labels: { singular: 'Weekly Events Slide', plural: 'Weekly Events Slides' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active'],
    description: 'Recurring weekly schedule shown on the kiosk. Changes auto-broadcast to all kiosks on save.',
    components: {
      beforeListTable: ['/src/admin/KioskContentBanner#WeeklyEventsSlidesBanner'],
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
    afterChange: [bumpKioskBroadcast],
  },
  fields: [
    { name: 'title', type: 'text', required: true, defaultValue: 'Weekly Schedule' },
    {
      name: 'entries',
      type: 'array',
      label: 'Schedule Entries',
      fields: [
        {
          name: 'day',
          type: 'select',
          required: true,
          options: [
            { label: 'Monday', value: 'mon' },
            { label: 'Tuesday', value: 'tue' },
            { label: 'Wednesday', value: 'wed' },
            { label: 'Thursday', value: 'thu' },
            { label: 'Friday', value: 'fri' },
            { label: 'Saturday', value: 'sat' },
            { label: 'Sunday', value: 'sun' },
          ],
        },
        { name: 'time', type: 'text', required: true, admin: { placeholder: '7:00 PM' } },
        { name: 'name', type: 'text', required: true },
        { name: 'location', type: 'text' },
        { name: 'audience', type: 'text', admin: { description: 'Optional, e.g. "Sisters", "Youth"' } },
      ],
    },
    { name: 'displayDurationMs', type: 'number', defaultValue: 15000, min: 5000, max: 60000 },
    { name: 'active', type: 'checkbox', defaultValue: true },
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
