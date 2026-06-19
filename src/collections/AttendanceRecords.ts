import type { CollectionConfig } from 'payload'
import { denyKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { assertSessionScope } from '../hooks/assertTeacherOwnsSession'
import {
  readByRole,
  writeByRole,
  schoolAdminCreate,
  teacherAttendanceResolve,
  schoolAdminAttendanceRead,
  roleOf,
  tenantOf,
} from '../access/schoolAccess'

export const AttendanceRecords: CollectionConfig = {
  slug: 'attendance-records',
  labels: { singular: 'Attendance Record', plural: 'Attendance Records' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Programs',
    hidden: true,
    useAsTitle: 'id',
    defaultColumns: ['student', 'session', 'status', 'markedAt'],
    description: "One student's attendance for one session.",
  },
  access: {
    read: denyKioskManager(readByRole({ teacher: teacherAttendanceResolve, schoolAdmin: schoolAdminAttendanceRead })),
    create: denyKioskManager((args) => {
      if (roleOf(args.req.user) === 'teacher') return Boolean(tenantOf(args.req.user))
      return schoolAdminCreate(args)
    }),
    update: denyKioskManager(writeByRole({ teacher: teacherAttendanceResolve, schoolAdmin: schoolAdminAttendanceRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminAttendanceRead })),
  },
  hooks: {
    beforeValidate: [assertSessionScope],
    beforeChange: [
      setTenantFromUser,
      ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          const next: Record<string, unknown> = { ...data, markedAt: new Date().toISOString() }
          // Kiosk writes run with overrideAccess and no user — don't clobber an
          // existing markedBy with undefined when a parent re-touches a record.
          if (req.user?.id) next.markedBy = req.user.id
          return next
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { hidden: true } },
    { name: 'session', type: 'relationship', relationTo: 'class-sessions', required: true, index: true },
    { name: 'student', type: 'relationship', relationTo: 'students', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Present', value: 'present' },
        { label: 'Absent', value: 'absent' },
        { label: 'Late', value: 'late' },
        { label: 'Excused', value: 'excused' },
      ],
    },
    { name: 'markedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    { name: 'markedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'checkInAt',
      type: 'date',
      admin: { readOnly: true, description: 'When the child was checked in (parent kiosk or staff).' },
    },
    {
      name: 'checkOutAt',
      type: 'date',
      admin: { readOnly: true, description: 'When the child was checked out at pickup.' },
    },
    {
      name: 'checkInBy',
      type: 'select',
      admin: { readOnly: true, description: 'How the check-in was recorded.' },
      options: [
        { label: 'Kiosk', value: 'kiosk' },
        { label: 'Staff', value: 'staff' },
      ],
    },
    { name: 'note', type: 'text' },
  ],
  indexes: [{ fields: ['tenant', 'session', 'student'], unique: true }],
}

export default AttendanceRecords
