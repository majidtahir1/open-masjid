import type { CollectionConfig } from 'payload'
import { denyKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  schoolTenantCreate,
  schoolTenantWrite,
  teacherClassesRead,
} from '../access/schoolAccess'
import { generateClassSessions } from '../hooks/generateClassSessions'
import { blockClassDeleteWithHistory } from '../hooks/blockClassDeleteWithHistory'

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
    read: denyKioskManager(teacherClassesRead),
    create: denyKioskManager(schoolTenantCreate),
    update: denyKioskManager(schoolTenantWrite),
    delete: denyKioskManager(schoolTenantWrite),
  },
  hooks: {
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
