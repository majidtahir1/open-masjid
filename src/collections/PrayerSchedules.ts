import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { autoRegeneratePrayerDays } from '../hooks/autoRegeneratePrayerDays'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { trimDaysToRange } from '../hooks/trimDaysToRange'

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const

const iqamahRuleFields = (prayer: (typeof PRAYERS)[number]) => ({
  name: prayer,
  type: 'group' as const,
  label: prayer.charAt(0).toUpperCase() + prayer.slice(1),
  fields: [
    {
      name: 'mode',
      type: 'select' as const,
      required: true,
      defaultValue: prayer === 'maghrib' ? 'offset' : 'absolute',
      label: 'Mode',
      options: [
        { label: 'Absolute time (same clock time every day)', value: 'absolute' },
        { label: 'Offset from adhan (N min after adhan)', value: 'offset' },
      ],
    },
    {
      name: 'absoluteValue',
      type: 'text' as const,
      label: 'Absolute Time',
      admin: {
        description: 'Example: "5:45 AM". Used when Mode = absolute.',
        placeholder: '5:45 AM',
        condition: (_: unknown, sibling: unknown) =>
          (sibling as { mode?: string })?.mode === 'absolute',
      },
    },
    {
      name: 'offsetMinutes',
      type: 'number' as const,
      label: 'Offset (minutes)',
      defaultValue: prayer === 'maghrib' ? 5 : 15,
      admin: {
        description: 'Whole minutes added to the computed adhan. Used when Mode = offset.',
        condition: (_: unknown, sibling: unknown) =>
          (sibling as { mode?: string })?.mode === 'offset',
      },
    },
  ],
})

const dayPrayerGroup = (prayer: (typeof PRAYERS)[number]) => ({
  name: prayer,
  type: 'group' as const,
  label: prayer.charAt(0).toUpperCase() + prayer.slice(1),
  fields: [
    { name: 'adhan', type: 'text' as const, admin: { placeholder: '5:30 AM' } },
    { name: 'iqamah', type: 'text' as const, admin: { placeholder: '5:45 AM' } },
  ],
})

export const PrayerSchedules: CollectionConfig = {
  slug: 'prayer-schedules',
  labels: {
    singular: 'Prayer schedule',
    plural: 'Prayer schedules',
  },
  admin: {
    group: 'Prayer',
    hideAPIURL: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'endDate', 'updatedAt'],
    description:
      'Prayer schedules cover a date range. Set the range + iqamah rules, then click "Generate times" to compute adhan times per day from the tenant’s location. Before any schedule’s start date has been reached, the public site shows "Prayer times coming soon".',
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
    beforeChange: [setTenantFromUser, trimDaysToRange, autoRegeneratePrayerDays],
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
      name: 'generateActions',
      type: 'ui',
      admin: {
        components: {
          Field: '/src/admin/GenerateTimesButton#default',
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
      type: 'row',
      fields: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
          index: true,
          admin: {
            date: { pickerAppearance: 'dayOnly' },
            description: 'First day this schedule covers.',
            components: {
              Field: '/src/fields/DateField#default',
            },
          },
        },
        {
          name: 'endDate',
          type: 'date',
          required: true,
          index: true,
          admin: {
            date: { pickerAppearance: 'dayOnly' },
            description:
              'Last day this schedule covers. "Generate times" builds one day-row per date in this range.',
            components: {
              Field: '/src/fields/DateField#default',
            },
          },
          validate: (value: unknown, { data }: { data?: { startDate?: string } }) => {
            if (!value || !data?.startDate) return true
            if (new Date(value as string) < new Date(data.startDate)) {
              return 'End date must be on or after Start date.'
            }
            return true
          },
        },
      ],
    },
    {
      name: 'iqamahRules',
      type: 'group',
      label: 'Iqamah Rules',
      admin: {
        description:
          'Bulk iqamah for every day in the range. Each prayer is either an absolute time or an offset from the computed adhan. Maghrib is usually an offset (e.g. "+5 min after sunset"); others are usually absolute. Click "Apply iqamah to range" after changing these to rewrite all days.',
      },
      fields: PRAYERS.map(iqamahRuleFields),
    },
    {
      name: 'jummahTimes',
      type: 'array',
      labels: { singular: 'Jummah time', plural: 'Jummah times' },
      admin: {
        description:
          'Absolute times for Friday Jummah (e.g. 12:45 PM, 1:30 PM, 2:15 PM). Replaces Zuhr iqamah on Fridays on the public site.',
      },
      fields: [
        {
          name: 'time',
          type: 'text',
          required: true,
          admin: {
            placeholder: '12:45 PM',
            components: {
              Field: '/src/fields/TextField#default',
            },
          },
        },
      ],
    },
    {
      name: 'days',
      type: 'array',
      label: 'Generated Days',
      labels: { singular: 'Day', plural: 'Days' },
      admin: {
        description:
          'One row per date in the range. Auto-filled on save when the range or iqamah rules change. Edit an individual row for per-day overrides; changing the range or rules will overwrite those edits on the next save.',
        initCollapsed: true,
        components: {
          RowLabel: '/src/admin/DayRowLabel#default',
        },
      },
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: { date: { pickerAppearance: 'dayOnly' } },
        },
        ...PRAYERS.map(dayPrayerGroup),
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
