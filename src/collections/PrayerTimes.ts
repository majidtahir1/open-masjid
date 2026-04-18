import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

export const PrayerTimes: CollectionConfig = {
  slug: 'prayer-times',
  labels: {
    singular: 'Prayer time',
    plural: 'Prayer times',
  },
  admin: {
    useAsTitle: 'date',
    defaultColumns: ['date', 'hijriDate', 'source', 'tenant'],
    description: 'One row per day. Each row holds adhan and iqamah times for all five prayers.',
  },
  defaultSort: '-date',
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
      name: 'date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        date: { pickerAppearance: 'dayOnly' },
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'fajrAdhan', type: 'text', required: true },
        { name: 'fajrIqamah', type: 'text', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'zuhrAdhan', type: 'text', required: true },
        { name: 'zuhrIqamah', type: 'text', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'asrAdhan', type: 'text', required: true },
        { name: 'asrIqamah', type: 'text', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'maghribAdhan', type: 'text', required: true },
        { name: 'maghribIqamah', type: 'text', required: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'ishaAdhan', type: 'text', required: true },
        { name: 'ishaIqamah', type: 'text', required: true },
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
      name: 'hijriDate',
      type: 'text',
      admin: {
        description: 'Optional Hijri date label, e.g. "27 Ramadan".',
      },
    },
    {
      name: 'notes',
      type: 'text',
      admin: {
        description: 'Optional, e.g. "Taraweeh after Isha".',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Manual entry', value: 'manual' },
        { label: 'API', value: 'api' },
        { label: 'CSV import', value: 'csv' },
      ],
      admin: { position: 'sidebar' },
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

export default PrayerTimes
