import type { CollectionConfig } from 'payload'
import { denyKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  readByRole,
  writeByRole,
  schoolAdminCreate,
  teacherStudentsResolve,
  schoolAdminStudentsRead,
} from '../access/schoolAccess'

export const Students: CollectionConfig = {
  slug: 'students',
  labels: { singular: 'Student', plural: 'Students' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Programs',
    hidden: true,
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'age', 'gradeLevel', 'status'],
    description: 'Children enrolled in the Sunday school. Holds guardian PII.',
  },
  access: {
    read: denyKioskManager(readByRole({ teacher: teacherStudentsResolve, schoolAdmin: schoolAdminStudentsRead })),
    create: denyKioskManager(schoolAdminCreate),
    update: denyKioskManager(writeByRole({ teacher: teacherStudentsResolve, schoolAdmin: schoolAdminStudentsRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminStudentsRead })),
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
    { name: 'gradeLevel', type: 'text', admin: { description: 'From registration (or set by admin); used for placement.' } },
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
      name: 'programSubscription',
      type: 'relationship',
      relationTo: 'program-subscriptions',
      admin: {
        readOnly: true,
        description: 'Family tuition subscription this student was registered under.',
      },
    },
    {
      name: 'registeredProgram',
      type: 'relationship',
      relationTo: 'terms',
      admin: { description: 'The program this student registered for (set at registration). A placement hint — students are not owned by a program.' },
    },
    {
      name: 'registrationDetails',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Snapshot of the original registration form answers (all fields), captured at submission time.',
      },
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
