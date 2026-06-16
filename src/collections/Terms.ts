import type { Access, CollectionConfig } from 'payload'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  schoolTenantCreate,
  schoolTenantRead,
  schoolTenantWrite,
  roleOf,
  tenantOf,
} from '../access/schoolAccess'

/** Terms are readable by any tenant member (incl. teachers); writable by admin/school_admin. */
const termRead: Access = (args) => {
  if (roleOf(args.req.user) === 'teacher') {
    const t = tenantOf(args.req.user)
    return t ? { tenant: { equals: t } } : false
  }
  return schoolTenantRead(args)
}

export const Terms: CollectionConfig = {
  slug: 'terms',
  labels: { singular: 'Term', plural: 'Terms' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Sunday School',
    hidden: hideForKioskManager,
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'endDate', 'meetingDay', 'status'],
    description: 'Academic periods for the Sunday school (e.g. "Fall 2026").',
  },
  access: {
    read: denyKioskManager(termRead),
    create: denyKioskManager(schoolTenantCreate),
    update: denyKioskManager(schoolTenantWrite),
    delete: denyKioskManager(schoolTenantWrite),
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { hidden: true } },
    { name: 'name', type: 'text', required: true },
    { name: 'startDate', type: 'date', required: true },
    { name: 'endDate', type: 'date', required: true },
    {
      name: 'meetingDay',
      type: 'select',
      required: true,
      defaultValue: 'sunday',
      options: [
        { label: 'Sunday', value: 'sunday' },
        { label: 'Monday', value: 'monday' },
        { label: 'Tuesday', value: 'tuesday' },
        { label: 'Wednesday', value: 'wednesday' },
        { label: 'Thursday', value: 'thursday' },
        { label: 'Friday', value: 'friday' },
        { label: 'Saturday', value: 'saturday' },
      ],
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
