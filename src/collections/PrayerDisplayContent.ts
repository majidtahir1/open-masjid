import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { bumpKioskBroadcast } from '../hooks/bumpKioskBroadcast'

export const PrayerDisplayContent: CollectionConfig = {
  slug: 'prayer-display-content',
  labels: { singular: 'Prayer Display Content', plural: 'Prayer Display Content' },
  admin: {
    group: 'Content',
    hideAPIURL: true,
    useAsTitle: 'english',
    defaultColumns: ['english', 'kind', 'active'],
    description:
      "Verses, hadith, and du’as shown in the hero of the prayer display. Any entry can appear on any of the three looks. Changes auto-broadcast to kiosks on save.",
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
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'ayah',
      options: [
        { label: 'Ayah (Qur’an)', value: 'ayah' },
        { label: 'Hadith', value: 'hadith' },
        { label: "Du’a", value: 'dua' },
        { label: 'Bismillah', value: 'bismillah' },
      ],
      admin: { description: 'A label only — it drives the small eyebrow text, not which look shows it.' },
    },
    {
      name: 'arabic',
      type: 'textarea',
      required: true,
      admin: { description: 'Arabic text with diacritics. Required.' },
    },
    {
      name: 'english',
      type: 'textarea',
      required: true,
      label: 'English translation',
      admin: { description: 'Required.' },
    },
    {
      name: 'citation',
      type: 'text',
      admin: { description: 'Free-form, e.g. "Surah An-Nisāʿ · 4:103" or "Ṣaḥīḥ al-Bukhārī".' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Off → removed from the rotation pool immediately on save.' },
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
