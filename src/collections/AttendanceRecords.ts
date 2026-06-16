import type { Access, CollectionConfig } from 'payload'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { assertTeacherOwnsSession } from '../hooks/assertTeacherOwnsSession'
import {
  schoolTenantCreate,
  schoolTenantWrite,
  teacherAttendanceRead,
  roleOf,
  tenantOf,
} from '../access/schoolAccess'

/** Teacher create is a boolean (any assigned teacher); the beforeValidate hook enforces session ownership. */
const attendanceCreate: Access = (args) => {
  if (roleOf(args.req.user) === 'teacher') return Boolean(tenantOf(args.req.user))
  return schoolTenantCreate(args)
}

/** Teacher gets their session-scoped write; everyone else routes through schoolTenantWrite (denies staff). */
const attendanceUpdate: Access = async (args) =>
  roleOf(args.req.user) === 'teacher' ? teacherAttendanceRead(args) : schoolTenantWrite(args)

export const AttendanceRecords: CollectionConfig = {
  slug: 'attendance-records',
  labels: { singular: 'Attendance Record', plural: 'Attendance Records' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Sunday School',
    hidden: hideForKioskManager,
    useAsTitle: 'id',
    defaultColumns: ['student', 'session', 'status', 'markedAt'],
    description: "One student's attendance for one session.",
  },
  access: {
    read: denyKioskManager(teacherAttendanceRead),
    create: denyKioskManager(attendanceCreate),
    update: denyKioskManager(attendanceUpdate),
    delete: denyKioskManager(schoolTenantWrite),
  },
  hooks: {
    beforeValidate: [assertTeacherOwnsSession],
    beforeChange: [
      setTenantFromUser,
      ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          return { ...data, markedBy: req.user?.id, markedAt: new Date().toISOString() }
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
    { name: 'note', type: 'text' },
  ],
  indexes: [{ fields: ['tenant', 'session', 'student'], unique: true }],
}

export default AttendanceRecords
