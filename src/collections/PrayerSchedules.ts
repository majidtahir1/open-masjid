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
    defaultColumns: ['name', 'isCurrent', 'startDate', 'tenant'],
    description:
      'Create a handful of schedules per year (e.g. Summer, Winter, Ramadan). The active schedule is determined by today\u2019s date: the most recent schedule whose start date has passed, falling back to the one marked \u201cCurrent\u201d.',
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
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'e.g. "Summer 2026", "Ramadan 2026", "Winter".',
      },
    },
    {
      name: 'isCurrent',
      type: 'checkbox',
      defaultValue: false,
      label: 'Current (baseline) schedule',
      admin: {
        description:
          'Leave startDate blank and check "Current" to mark this as the baseline schedule shown when no dated schedule applies. Only one schedule per masjid may be Current.',
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
                      admin: { placeholder: 'e.g. 5:30 AM' },
                    },
                    {
                      name: 'iqamah',
                      type: 'text',
                      label: 'Fajr Iqamah',
                      admin: { placeholder: 'e.g. 5:45 AM' },
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
                  admin: { placeholder: 'e.g. 1:30 PM' },
                },
                {
                  name: 'iqamah',
                  type: 'text',
                  label: 'Zuhr Iqamah',
                  admin: { placeholder: 'e.g. 1:45 PM' },
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
                  admin: { placeholder: 'e.g. 5:00 PM' },
                },
                {
                  name: 'iqamah',
                  type: 'text',
                  label: 'Asr Iqamah',
                  admin: { placeholder: 'e.g. 5:15 PM' },
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
                  admin: { placeholder: 'e.g. at sunset' },
                },
                {
                  name: 'iqamah',
                  type: 'text',
                  label: 'Maghrib Iqamah',
                  admin: { placeholder: 'e.g. sunset + 5 min' },
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
                  admin: { placeholder: 'e.g. 9:15 PM' },
                },
                {
                  name: 'iqamah',
                  type: 'text',
                  label: 'Isha Iqamah',
                  admin: { placeholder: 'e.g. 9:30 PM' },
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
      fields: [{ name: 'time', type: 'text', required: true }],
    },
    {
      name: 'notes',
      type: 'text',
      admin: {
        description: 'Optional, e.g. "Taraweeh after Isha".',
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
