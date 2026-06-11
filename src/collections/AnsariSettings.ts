// src/collections/AnsariSettings.ts
import type { CollectionConfig } from 'payload'

import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { RULE_IDS } from '../ansari/ruleIds'

export const AnsariSettings: CollectionConfig = {
  slug: 'ansari-settings',
  labels: { singular: 'Ansari Settings', plural: 'Ansari Settings' },
  admin: {
    group: 'Ansari',
    description:
      'Proactive nudge preferences for this masjid: which nudges are on, quiet hours, and the weekly digest slot.',
    useAsTitle: 'id',
  },
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
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      unique: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      label: 'Proactive nudges enabled',
    },
    {
      name: 'disabledRules',
      type: 'select',
      hasMany: true,
      label: 'Disabled nudge types',
      options: RULE_IDS.map((id) => ({ label: id, value: id })),
      admin: {
        description: 'Nudge types Ansari will stay silent about ("Stop these" also lands here).',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'quietHoursStart',
          type: 'number',
          defaultValue: 21,
          min: 0,
          max: 23,
          label: 'Quiet from (hour, 0-23)',
          admin: { width: '50%', description: 'No immediate nudges from this local hour…' },
        },
        {
          name: 'quietHoursEnd',
          type: 'number',
          defaultValue: 8,
          min: 0,
          max: 23,
          label: 'Quiet until (hour, 0-23)',
          admin: { width: '50%', description: '…until this local hour.' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'digestDay',
          type: 'select',
          defaultValue: '0',
          label: 'Weekly digest day',
          options: [
            { label: 'Sunday', value: '0' },
            { label: 'Monday', value: '1' },
            { label: 'Tuesday', value: '2' },
            { label: 'Wednesday', value: '3' },
            { label: 'Thursday', value: '4' },
            { label: 'Friday', value: '5' },
            { label: 'Saturday', value: '6' },
          ],
          admin: { width: '50%' },
        },
        {
          name: 'digestHour',
          type: 'number',
          defaultValue: 9,
          min: 0,
          max: 23,
          label: 'Digest hour (local, 0-23)',
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'telegramConnected',
      type: 'checkbox',
      defaultValue: false,
      label: 'Telegram connected',
      admin: { description: 'Set when Hermes binds a Telegram chat to this masjid.' },
    },
  ],
}
