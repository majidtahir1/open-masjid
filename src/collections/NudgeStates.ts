// src/collections/NudgeStates.ts
import type { CollectionConfig } from 'payload'

import { platformOwnerOnly, tenantScopedRead } from '../access/tenantScoped'
import { denyKioskManager, hideForNonPlatformOwner } from '../access/kioskRoles'

export const NudgeStates: CollectionConfig = {
  slug: 'nudge-states',
  labels: { singular: 'Nudge State', plural: 'Nudge States' },
  admin: {
    group: 'Ansari',
    description: 'Dedup + lifecycle bookkeeping for proactive nudges. Managed by the engine.',
    defaultColumns: ['rule', 'dedupKey', 'status', 'emittedAt'],
    // Internal engine bookkeeping — only useful to platform owners for testing.
    // Tenants never see it in the sidebar.
    hidden: hideForNonPlatformOwner,
  },
  access: {
    read: denyKioskManager(tenantScopedRead),
    // Lifecycle writes happen server-side with overrideAccess: true; humans only read.
    create: denyKioskManager(platformOwnerOnly),
    update: denyKioskManager(platformOwnerOnly),
    delete: denyKioskManager(platformOwnerOnly),
  },
  timestamps: true,
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'rule', type: 'text', required: true, index: true },
    { name: 'dedupKey', type: 'text', required: true, index: true },
    {
      name: 'tier',
      type: 'select',
      required: true,
      options: [
        { label: 'Immediate', value: 'immediate' },
        { label: 'Digest', value: 'digest' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'emitted',
      index: true,
      options: [
        { label: 'Emitted (awaiting Hermes ack)', value: 'emitted' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Applied', value: 'applied' },
        { label: 'Dismissed', value: 'dismissed' },
        { label: 'Snoozed (Not now)', value: 'snoozed' },
        { label: 'Resolved', value: 'resolved' },
      ],
    },
    { name: 'intent', type: 'json' },
    { name: 'action', type: 'json' },
    { name: 'emittedAt', type: 'date' },
    { name: 'deliveredAt', type: 'date' },
    { name: 'snoozedAt', type: 'date' },
    { name: 'resolvedAt', type: 'date' },
  ],
}
