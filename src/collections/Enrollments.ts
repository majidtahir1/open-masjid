import type { CollectionConfig } from 'payload'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  schoolTenantCreate,
  schoolTenantWrite,
  teacherEnrollmentsRead,
} from '../access/schoolAccess'

export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  labels: { singular: 'Enrollment', plural: 'Enrollments' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Sunday School',
    hidden: hideForKioskManager,
    useAsTitle: 'id',
    defaultColumns: ['student', 'class', 'status', 'enrolledAt'],
    description: 'Joins a student to a class for a term (the roster).',
  },
  access: {
    read: denyKioskManager(teacherEnrollmentsRead),
    create: denyKioskManager(schoolTenantCreate),
    update: denyKioskManager(schoolTenantWrite),
    delete: denyKioskManager(schoolTenantWrite),
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { hidden: true } },
    { name: 'student', type: 'relationship', relationTo: 'students', required: true, index: true },
    { name: 'class', type: 'relationship', relationTo: 'school-classes', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Withdrawn', value: 'withdrawn' },
      ],
    },
    { name: 'enrolledAt', type: 'date', defaultValue: () => new Date().toISOString() },
  ],
  indexes: [{ fields: ['tenant', 'student', 'class'], unique: true }],
}

export default Enrollments
