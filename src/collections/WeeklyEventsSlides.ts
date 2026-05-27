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
    group: 'Displays',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active'],
    description:
      'Recurring weekly schedule shown on the kiosk. Changes auto-broadcast to all kiosks on save.',
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
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Schedule',
          description:
            'Each entry is one event in the weekly grid. Order in admin doesn\'t matter — the kiosk groups them by day automatically.',
          fields: [
            {
              name: 'title',
              type: 'text',
              required: true,
              defaultValue: 'Weekly Schedule',
              admin: { description: 'Heading shown on the slide.' },
            },
            {
              name: 'entries',
              type: 'array',
              label: 'Entries',
              labels: { singular: 'Event', plural: 'Events' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'day',
                      type: 'select',
                      required: true,
                      admin: { width: '40%' },
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
                    {
                      name: 'time',
                      type: 'text',
                      required: true,
                      admin: { placeholder: '7:00 PM', width: '60%' },
                    },
                  ],
                },
                {
                  name: 'name',
                  type: 'text',
                  required: true,
                  admin: { description: 'e.g. "Quran Class with Sh. Ahmad"' },
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'location',
                      type: 'text',
                      admin: { width: '60%', description: 'Optional. e.g. "Hall A"' },
                    },
                    {
                      name: 'audience',
                      type: 'text',
                      admin: { width: '40%', description: 'Optional. e.g. "Sisters" or "Youth"' },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Display',
          description: 'When and how this slide appears in the rotation.',
          fields: [
            { name: 'active', type: 'checkbox', defaultValue: true },
            {
              name: 'displayDurationMs',
              type: 'number',
              defaultValue: 15000,
              min: 5000,
              max: 60000,
              label: 'Display duration',
              admin: { description: 'Time on screen in milliseconds. Default 15000 (15s).' },
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
