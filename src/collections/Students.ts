import type { Access, CollectionConfig } from 'payload'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  schoolTenantCreate,
  schoolTenantWrite,
  teacherStudentsRead,
  roleOf,
} from '../access/schoolAccess'

/**
 * Update access: teachers may update only their enrolled students;
 * other roles fall through to schoolTenantWrite (staff are denied).
 */
const teacherStudentsUpdate: Access = async (args) => {
  if (roleOf(args.req.user) === 'teacher') return teacherStudentsRead(args)
  return schoolTenantWrite(args)
}

export const Students: CollectionConfig = {
  slug: 'students',
  labels: { singular: 'Student', plural: 'Students' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Sunday School',
    hidden: hideForKioskManager,
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'age', 'gradeLevel', 'status'],
    description: 'Children enrolled in the Sunday school. Holds guardian PII.',
  },
  access: {
    read: denyKioskManager(teacherStudentsRead),
    create: denyKioskManager(schoolTenantCreate),
    update: denyKioskManager(teacherStudentsUpdate),
    delete: denyKioskManager(schoolTenantWrite),
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { hidden: true } },
    {
      name: 'fullName',
      type: 'text',
      admin: { readOnly: true, description: 'Auto-filled from first + last name.' },
      hooks: {
        beforeChange: [
          ({ siblingData }) =>
            [siblingData?.firstName, siblingData?.lastName].filter(Boolean).join(' ').trim() ||
            undefined,
        ],
      },
    },
    { name: 'firstName', type: 'text', required: true },
    { name: 'lastName', type: 'text', required: true },
    { name: 'age', type: 'number', min: 0, max: 25, admin: { description: 'Captured at registration.' } },
    { name: 'gradeLevel', type: 'text', admin: { description: 'Assigned by admin during placement.' } },
    {
      name: 'guardians',
      type: 'array',
      labels: { singular: 'Guardian', plural: 'Guardians' },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'relationship', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'isPrimary', type: 'checkbox', defaultValue: false },
      ],
    },
    { name: 'allergiesNotes', type: 'textarea' },
    { name: 'emergencyContact', type: 'text' },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'members',
      admin: { description: 'Optional link to a paying Member (reserved for future tuition).' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
    {
      name: 'attendance',
      type: 'join',
      collection: 'attendance-records',
      on: 'student',
      admin: { description: 'Attendance history for this student.' },
    },
  ],
}

export default Students
