import type { CollectionConfig } from 'payload'
import { denyKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { syncTermSessions } from '../hooks/syncTermSessions'
import {
  readByRole,
  writeByRole,
  adminOnlyCreate,
  schoolAdminTermsRead,
  tenantOf,
} from '../access/schoolAccess'

export const Terms: CollectionConfig = {
  slug: 'terms',
  labels: { singular: 'Program', plural: 'Programs' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Programs',
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'endDate', 'status'],
    description: 'Programs (e.g. a Sunday school term, a Saturday program, or a summer camp).',
  },
  access: {
    read: denyKioskManager(readByRole({
      teacher: async (req) => { const t = tenantOf(req.user); return t ? { tenant: { equals: t } } : false },
      schoolAdmin: schoolAdminTermsRead,
    })),
    create: denyKioskManager(adminOnlyCreate),
    update: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminTermsRead })),
    delete: denyKioskManager(adminOnlyCreate),
  },
  hooks: { beforeChange: [setTenantFromUser], afterChange: [syncTermSessions] },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { hidden: true } },
    { name: 'name', type: 'text', required: true },
    { name: 'startDate', type: 'date', required: true },
    { name: 'endDate', type: 'date', required: true },
    {
      name: 'holidays',
      type: 'array',
      labels: { singular: 'Day off', plural: 'Days off' },
      admin: { description: 'Meeting-day dates the school does not meet. Sessions are not created on these days.' },
      fields: [
        { name: 'date', type: 'date', required: true },
        { name: 'label', type: 'text', admin: { description: 'Optional (e.g. "Winter break").' } },
      ],
    },
    {
      name: 'meetingDays',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['sunday'],
      label: 'Meets on',
      options: [
        { label: 'Sunday', value: 'sunday' },
        { label: 'Monday', value: 'monday' },
        { label: 'Tuesday', value: 'tuesday' },
        { label: 'Wednesday', value: 'wednesday' },
        { label: 'Thursday', value: 'thursday' },
        { label: 'Friday', value: 'friday' },
        { label: 'Saturday', value: 'saturday' },
      ],
      admin: { description: 'Days the program meets each week. Sessions are created on every selected day.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
    },
  ],
}

export default Terms
