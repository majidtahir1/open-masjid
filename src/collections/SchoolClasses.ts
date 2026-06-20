import type { CollectionConfig } from 'payload'
import { denyKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  readByRole,
  writeByRole,
  schoolAdminCreate,
  teacherClassesResolve,
  schoolAdminClassesRead,
} from '../access/schoolAccess'
import { generateClassSessions } from '../hooks/generateClassSessions'
import { blockClassDeleteWithHistory } from '../hooks/blockClassDeleteWithHistory'
import { assertClassProgramScope } from '../hooks/assertProgramScope'

export const SchoolClasses: CollectionConfig = {
  slug: 'school-classes',
  labels: { singular: 'Class', plural: 'Classes' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Programs',
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'term', 'gradeLevel', 'room', 'capacity'],
    description: 'A class offered in a term (e.g. "Grade 3 Quran").',
  },
  access: {
    read: denyKioskManager(readByRole({ teacher: teacherClassesResolve, schoolAdmin: schoolAdminClassesRead })),
    create: denyKioskManager(schoolAdminCreate),
    update: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminClassesRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminClassesRead })),
  },
  hooks: {
    beforeValidate: [assertClassProgramScope],
    beforeDelete: [blockClassDeleteWithHistory],
    beforeChange: [setTenantFromUser],
    afterChange: [generateClassSessions],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { hidden: true } },
    { name: 'name', type: 'text', required: true },
    { name: 'term', type: 'relationship', relationTo: 'terms', required: true, index: true },
    { name: 'teachers', type: 'relationship', relationTo: 'users', hasMany: true, index: true },
    { name: 'gradeLevel', type: 'text' },
    { name: 'room', type: 'text' },
    { name: 'capacity', type: 'number', min: 0, admin: { description: 'Informational only — not enforced.' } },
    { name: 'tuitionCents', type: 'number', min: 0, admin: { hidden: true } },
    {
      name: 'tuition',
      type: 'number',
      virtual: true,
      min: 0,
      label: 'Monthly tuition',
      admin: { description: 'Dollars per month for this class (per-class pricing). E.g. enter 90 for $90/mo.', step: 1 },
      hooks: {
        afterRead: [({ siblingData }) => { const c = (siblingData as { tuitionCents?: number | null })?.tuitionCents; return typeof c === 'number' ? c / 100 : undefined }],
        beforeValidate: [({ value, siblingData }) => { if (typeof value === 'number' && Number.isFinite(value)) (siblingData as { tuitionCents?: number }).tuitionCents = Math.round(value * 100); return value }],
      },
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
      admin: { description: 'Archived classes are hidden from the live list but keep their history.' },
    },
  ],
}

export default SchoolClasses
