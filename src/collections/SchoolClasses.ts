import type { CollectionConfig } from 'payload'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  schoolTenantCreate,
  schoolTenantWrite,
  teacherClassesRead,
} from '../access/schoolAccess'
import { generateClassSessions } from '../hooks/generateClassSessions'

export const SchoolClasses: CollectionConfig = {
  slug: 'school-classes',
  labels: { singular: 'Class', plural: 'Classes' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Sunday School',
    hidden: hideForKioskManager,
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
  ],
}

export default SchoolClasses
