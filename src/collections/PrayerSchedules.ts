import type { CollectionConfig, Validate } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

/**
 * Validate that only one schedule per tenant can have `isCurrent: true`.
 *
 * If the user is trying to set this record's `isCurrent` to true and another
 * record in the same tenant already has it, we block with a clear message.
 * Staff can flip the other schedule off first and then re-save this one.
 */
const validateSingleCurrent: Validate = async (value, options) => {
  if (value !== true) return true

  const opts = options as {
    req: {
      user?:
        | { role?: string; tenant?: string | number | { id: string | number } }
        | null
      payload: {
        find: (args: unknown) => Promise<{
          docs: Array<{ id: string | number }>
        }>
      }
    }
    data?: { tenant?: string | number | { id: string | number } }
    id?: string | number
  }

  // Resolve the tenant for this record:
  // - platformOwner may have set data.tenant on the form
  // - tenant users implicitly use their own tenant (setTenantFromUser hook)
  const rec = opts.data
  const user = opts.req.user
  const id = opts.id
  const req = opts.req

  const pickId = (t: unknown): string | number | null => {
    if (!t) return null
    if (typeof t === 'object' && t !== null && 'id' in (t as Record<string, unknown>)) {
      return (t as { id: string | number }).id
    }
    return t as string | number
  }

  const tenantId = pickId(rec?.tenant) ?? pickId(user?.tenant)
  if (!tenantId) return true

  try {
    const payload = req.payload
    const existing = await payload.find({
      collection: 'prayer-schedules',
      where: {
        tenant: { equals: tenantId },
        isCurrent: { equals: true },
      },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })

    const conflict = existing.docs.find((d: { id: string | number }) => d.id !== id)
    if (conflict) {
      return 'Another schedule is already marked Current for this masjid. Uncheck it before setting this one as Current.'
    }
  } catch {
    // If the lookup fails (e.g. table being created), don't block the save.
    return true
  }

  return true
}

export const PrayerSchedules: CollectionConfig = {
  slug: 'prayer-schedules',
  labels: {
    singular: 'Prayer schedule',
    plural: 'Prayer schedules',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'isCurrent', 'updatedAt'],
    description:
      'Prayer time schedules. The ACTIVE schedule right now is the one with the most recent start date that has already passed. If no dated schedule applies (e.g. on first launch), the \u201cfallback\u201d schedule is used. To see which schedule is active today, check the \u201cActive now\u201d indicator on the list or the banner at the top of each schedule.',
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
          Field: '/admin/ActiveScheduleBanner#default',
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
        },
      },
    },
    {
      name: 'isCurrent',
      type: 'checkbox',
      defaultValue: false,
      label: 'Use as fallback (baseline) schedule',
      admin: {
        description:
          'When checked, this schedule is used ONLY if no dated schedule\u2019s start date has been reached. It\u2019s the default when nothing else applies. The actively-displayed schedule at any moment is the one with the most recent past start date \u2014 not necessarily this one.',
        components: {
          Field: '/src/fields/CheckboxField#default',
        },
      },
      validate: validateSingleCurrent,
    },
    {
      name: 'startDate',
      type: 'date',
      index: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
        description:
          'The date this schedule activates. It stays active until a later schedule\u2019s start date kicks in. Leave blank for the baseline (Current) schedule.',
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
