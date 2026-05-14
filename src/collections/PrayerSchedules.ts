import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { withBillingLock } from '../access/billingLocked'
import { allowKioskManagerRead, denyKioskManager } from '../access/kioskRoles'
import { autoRegeneratePrayerDays } from '../hooks/autoRegeneratePrayerDays'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { trimDaysToRange } from '../hooks/trimDaysToRange'

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const

const iqamahRuleFields = (prayer: (typeof PRAYERS)[number]) => ({
  type: 'collapsible' as const,
  label: prayer.charAt(0).toUpperCase() + prayer.slice(1),
  admin: { initCollapsed: false },
  fields: [
    {
      name: prayer,
      type: 'group' as const,
      label: false as const,
      admin: { hideGutter: true },
      fields: [
        {
          type: 'row' as const,
          fields: [
            {
              name: 'mode',
              type: 'select' as const,
              required: true,
              defaultValue: prayer === 'maghrib' ? 'offset' : 'absolute',
              label: 'Mode',
              options: [
                { label: 'Absolute', value: 'absolute' },
                { label: 'Offset from adhan', value: 'offset' },
              ],
              admin: { width: '40%' },
            },
            {
              name: 'absoluteValue',
              type: 'text' as const,
              label: 'Time',
              admin: {
                placeholder: '5:45 AM',
                width: '60%',
                condition: (_: unknown, sibling: unknown) =>
                  (sibling as { mode?: string })?.mode === 'absolute',
              },
            },
            {
              name: 'offsetMinutes',
              type: 'number' as const,
              label: 'Minutes after adhan',
              defaultValue: prayer === 'maghrib' ? 5 : 15,
              admin: {
                width: '60%',
                condition: (_: unknown, sibling: unknown) =>
                  (sibling as { mode?: string })?.mode === 'offset',
              },
            },
          ],
        },
      ],
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
    enableListViewSelectAPI: true,
    group: 'Prayer',
    hideAPIURL: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'endDate', 'updatedAt'],
    description:
      'Prayer schedules cover a date range. Set the range + iqamah rules, then click "Generate times" to compute adhan times per day from the tenant’s location. Before any schedule’s start date has been reached, the public site shows "Prayer times coming soon".',
    components: {
      beforeListTable: [
        '/src/admin/ScheduleListBanner#default',
        '/src/admin/ScheduleTimeline#default',
      ],
      edit: {
        beforeDocumentControls: ['/src/components/admin/TenantPushButton#default'],
      },
    },
  },
  defaultSort: '-startDate',
  access: {
    read: allowKioskManagerRead(tenantScopedRead),
    create: denyKioskManager(withBillingLock(tenantScopedCreate)),
    update: denyKioskManager(withBillingLock(tenantScopedUpdate)),
    delete: denyKioskManager(withBillingLock(tenantScopedDelete)),
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
              Cell: '/src/admin/DateOnlyCell#default',
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
              Cell: '/src/admin/DateOnlyCell#default',
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
      name: 'adhanPreview',
      type: 'ui',
      admin: {
        components: {
          Field: '/src/admin/AdhanRangePreview#default',
        },
      },
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
      name: 'generateActions',
      type: 'ui',
      admin: {
        components: {
          Field: '/src/admin/GenerateTimesButton#default',
        },
      },
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
        {
          name: 'sunrise',
          type: 'text',
          label: 'Sunrise (Fajr ends)',
          admin: {
            description:
              'Fajr must be prayed before sunrise. Informational — not shown on the public site by default.',
            placeholder: '6:45 AM',
          },
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
