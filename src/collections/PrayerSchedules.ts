import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

export const PrayerSchedules: CollectionConfig = {
  slug: 'prayer-schedules',
  labels: {
    singular: 'Prayer schedule',
    plural: 'Prayer schedules',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'updatedAt'],
    description:
      'Prayer schedules. The active schedule right now is the one with the most recent start date that has already passed. When you create a new seasonal schedule (e.g. "Summer 2026"), set its start date; it takes effect on that day. Before the first schedule\u2019s start date arrives, the public site shows "Prayer times coming soon".',
    components: {
      beforeListTable: ['/src/admin/ScheduleListBanner#default'],
    },
  },
  defaultSort: '-startDate',
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
      name: 'activeBanner',
      type: 'ui',
      admin: {
        components: {
          Field: '/src/admin/ActiveScheduleBanner#default',
        },
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'e.g. "Summer 2026", "Ramadan 2026", "Winter".',
        components: {
          Field: '/src/fields/TextField#default',
          Cell: '/src/admin/ScheduleNameCell#default',
        },
      },
    },
    {
      name: 'startDate',
      type: 'date',
      index: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description:
          'The date this schedule activates. It stays active until a later schedule\u2019s start date kicks in. If no schedule\u2019s start date has been reached yet, the public site shows "Prayer times coming soon".',
        components: {
          Field: '/src/fields/DateField#default',
        },
      },
    },
    {
      type: 'collapsible',
      label: 'Fajr',
      admin: { initCollapsed: false },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'fajr',
              type: 'group',
              label: false,
              admin: { hideGutter: true },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'adhan',
                      type: 'text',
                      label: 'Fajr Adhan',
                      admin: {
                        placeholder: 'e.g. 5:30 AM',
                        components: {
                          Field: '/src/fields/TextField#default',
                        },
                      },
                    },
                    {
                      name: 'iqamah',
                      type: 'text',
                      label: 'Fajr Iqamah',
                      admin: {
                        placeholder: 'e.g. 5:45 AM',
                        components: {
                          Field: '/src/fields/TextField#default',
                        },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Zuhr',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'zuhr',
          type: 'group',
          label: false,
          admin: { hideGutter: true },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'adhan',
                  type: 'text',
                  label: 'Zuhr Adhan',
                  admin: {
                    placeholder: 'e.g. 1:30 PM',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'iqamah',
                  type: 'text',
                  label: 'Zuhr Iqamah',
                  admin: {
                    placeholder: 'e.g. 1:45 PM',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Asr',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'asr',
          type: 'group',
          label: false,
          admin: { hideGutter: true },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'adhan',
                  type: 'text',
                  label: 'Asr Adhan',
                  admin: {
                    placeholder: 'e.g. 5:00 PM',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'iqamah',
                  type: 'text',
                  label: 'Asr Iqamah',
                  admin: {
                    placeholder: 'e.g. 5:15 PM',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Maghrib',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'maghrib',
          type: 'group',
          label: false,
          admin: { hideGutter: true },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'adhan',
                  type: 'text',
                  label: 'Maghrib Adhan',
                  admin: {
                    placeholder: 'e.g. at sunset',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'iqamah',
                  type: 'text',
                  label: 'Maghrib Iqamah',
                  admin: {
                    placeholder: 'e.g. sunset + 5 min',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Isha',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'isha',
          type: 'group',
          label: false,
          admin: { hideGutter: true },
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'adhan',
                  type: 'text',
                  label: 'Isha Adhan',
                  admin: {
                    placeholder: 'e.g. 9:15 PM',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
                {
                  name: 'iqamah',
                  type: 'text',
                  label: 'Isha Iqamah',
                  admin: {
                    placeholder: 'e.g. 9:30 PM',
                    components: {
                      Field: '/src/fields/TextField#default',
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'jummahTimes',
      type: 'array',
      labels: { singular: 'Jummah time', plural: 'Jummah times' },
      admin: {
        description: 'e.g. "12:45 PM", "1:30 PM", "2:15 PM".',
      },
      fields: [
        {
          name: 'time',
          type: 'text',
          required: true,
          admin: {
            components: {
              Field: '/src/fields/TextField#default',
            },
          },
        },
      ],
    },
    {
      name: 'notes',
      type: 'text',
      admin: {
        description: 'Optional, e.g. "Taraweeh after Isha".',
        components: {
          Field: '/src/fields/TextField#default',
        },
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
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

export default PrayerSchedules
