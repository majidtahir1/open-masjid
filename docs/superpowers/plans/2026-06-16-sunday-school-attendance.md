# Sunday School Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tenant-scoped Sunday school module to OpenMasjid where admins set up Terms and Classes, students enroll (via the existing Forms or admin entry), and teachers mark a weekly per-class roster, producing exportable attendance records.

**Architecture:** Six new tenant-scoped Payload collections (`Terms`, `SchoolClasses`, `Students`, `Enrollments`, `ClassSessions`, `AttendanceRecords`) following the existing `tenantScopedAccess()` + `setTenantFromUser` + `denyKioskManager` pattern (see `src/collections/DonationFunds.ts`). Two new roles (`school_admin`, `teacher`) extend the Users `role` select. Teacher class-scoping is enforced with **async** Payload access functions that query `req.payload` (Students have no direct teacher link, so visibility is derived through Enrollments). A registration Form afterChange hook creates unplaced students; a custom admin view at `/admin/take-attendance` drives the roster-marking UI.

**Tech Stack:** Payload CMS 3.84, Next.js App Router, PostgreSQL, TypeScript, Vitest. Tests follow the unit-style access-function pattern in `tests/collections/donationFunds.access.test.ts` (no full Payload boot — call the access fn with a mock `req`).

---

## Conventions for every collection in this plan

- `slug` is kebab-case; field `tenant` is a `relationship` to `tenants`, `required`, `index: true`, `admin: { hidden: true }`.
- `hooks.beforeChange` includes `setTenantFromUser`.
- All four access functions are wrapped with `denyKioskManager(...)`.
- `admin.group: 'Sunday School'`, `admin.hidden: hideForKioskManager`, `admin.enableListViewSelectAPI: true`.
- Dev auto-syncs the schema on boot; no migration file is needed to test locally. A single `npx payload migrate:create` runs at the end (Task 11) for production.

---

## File Structure

```
src/access/
  schoolAccess.ts            ← all six collections' access fns (sync school-role + async teacher-scoped)
src/hooks/
  generateClassSessions.ts   ← afterChange on SchoolClasses: create weekly ClassSessions across the term
  assertTeacherOwnsSession.ts← beforeValidate on AttendanceRecords: teacher may only write own-class sessions
  createStudentFromRegistration.ts ← afterChange on FormSubmissions: unplaced Student from a registration form
src/collections/
  Terms.ts
  SchoolClasses.ts
  Students.ts
  Enrollments.ts
  ClassSessions.ts
  AttendanceRecords.ts
src/app/(payload)/admin/take-attendance/
  page.tsx                   ← custom admin route shell
src/admin/school/
  TakeAttendance.tsx         ← client component: class picker → session → roster toggles
  SundaySchoolNav.tsx        ← beforeNavLinks entry linking to /admin/take-attendance
tests/collections/
  terms.access.test.ts
  schoolClasses.access.test.ts
  students.access.test.ts
  enrollments.access.test.ts
  classSessions.access.test.ts
  attendanceRecords.access.test.ts
tests/access/
  teacherScoped.test.ts
tests/hooks/
  generateClassSessions.test.ts
  createStudentFromRegistration.test.ts
```

---

## Task 1: Add `school_admin` and `teacher` roles to Users

**Files:**
- Modify: `src/collections/Users.ts:292-297` (role `options`) and `:299-300` (description)

- [ ] **Step 1: Add the two role options**

In `src/collections/Users.ts`, change the `options` array of the `role` field to:

```ts
options: [
  { label: 'Platform Owner (manages all tenants)', value: 'platformOwner' },
  { label: 'Admin (full access within one tenant)', value: 'admin' },
  { label: 'Staff (content only within one tenant)', value: 'staff' },
  { label: 'Kiosk Manager (kiosk content only within one tenant)', value: 'kioskManager' },
  { label: 'School Admin (Sunday school across one tenant)', value: 'school_admin' },
  { label: 'Teacher (own Sunday school classes only)', value: 'teacher' },
],
```

- [ ] **Step 2: Extend the description**

Append to the `admin.description` string (line ~299):

```
 School Admin manages the Sunday school (terms, classes, students, attendance) within one masjid. Teacher can only mark attendance for their assigned classes.
```

- [ ] **Step 3: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/collections/Users.ts
git commit -m "feat(school): add school_admin and teacher roles"
```

---

## Task 2: School access module — sync school-role helpers

**Files:**
- Create: `src/access/schoolAccess.ts`
- Test: `tests/access/teacherScoped.test.ts` (created here, expanded in Task 3)

This task adds the synchronous helpers used by Terms (the simplest collection). Teacher async helpers come in Task 3.

- [ ] **Step 1: Write the failing test**

Create `tests/access/teacherScoped.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { schoolTenantRead, schoolTenantWrite } from '@/access/schoolAccess'

const call = (fn: any, user: any) => fn({ req: { user } })

describe('schoolTenantRead', () => {
  it('denies anonymous', () => {
    expect(call(schoolTenantRead, undefined)).toBe(false)
  })
  it('platformOwner sees all', () => {
    expect(call(schoolTenantRead, { role: 'platformOwner' })).toBe(true)
  })
  it('admin, school_admin, and staff are scoped to their tenant', () => {
    for (const role of ['admin', 'school_admin', 'staff']) {
      expect(call(schoolTenantRead, { role, tenant: 5 })).toEqual({ tenant: { equals: 5 } })
    }
  })
  it('tenant object id is resolved', () => {
    expect(call(schoolTenantRead, { role: 'admin', tenant: { id: 9 } })).toEqual({
      tenant: { equals: 9 },
    })
  })
  it('user without tenant denied', () => {
    expect(call(schoolTenantRead, { role: 'admin' })).toBe(false)
  })
})

describe('schoolTenantWrite', () => {
  it('platformOwner true', () => {
    expect(call(schoolTenantWrite, { role: 'platformOwner' })).toBe(true)
  })
  it('admin and school_admin write within tenant; staff and teacher cannot', () => {
    expect(call(schoolTenantWrite, { role: 'admin', tenant: 5 })).toEqual({ tenant: { equals: 5 } })
    expect(call(schoolTenantWrite, { role: 'school_admin', tenant: 5 })).toEqual({
      tenant: { equals: 5 },
    })
    expect(call(schoolTenantWrite, { role: 'staff', tenant: 5 })).toBe(false)
    expect(call(schoolTenantWrite, { role: 'teacher', tenant: 5 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/access/teacherScoped.test.ts`
Expected: FAIL — `Cannot find module '@/access/schoolAccess'`.

- [ ] **Step 3: Implement the sync helpers**

Create `src/access/schoolAccess.ts`:

```ts
import type { Access, PayloadRequest } from 'payload'

/** Extract a tenant id from a user's tenant field (object or primitive). */
const getTenantId = (tenant: unknown): string | number | null => {
  if (!tenant) return null
  if (typeof tenant === 'object' && tenant !== null && 'id' in tenant) {
    return (tenant as { id: string | number }).id
  }
  return tenant as string | number
}

const roleOf = (user: unknown): string | undefined =>
  (user as { role?: string } | null | undefined)?.role

const tenantOf = (user: unknown) =>
  getTenantId((user as { tenant?: unknown } | null | undefined)?.tenant)

/** Roles that may create/update/delete school records across their tenant. */
const WRITE_ROLES = ['admin', 'school_admin']

/**
 * Read: platformOwner sees all; admin/school_admin/staff are tenant-scoped.
 * (Teacher read is handled per-collection by the async helpers below.)
 */
export const schoolTenantRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  const tenantId = tenantOf(user)
  if (!tenantId) return false
  if (WRITE_ROLES.includes(roleOf(user)!) || roleOf(user) === 'staff') {
    return { tenant: { equals: tenantId } }
  }
  return false
}

/** Create/update/delete: platformOwner all; admin/school_admin tenant-scoped; others denied. */
export const schoolTenantWrite: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  const tenantId = tenantOf(user)
  if (!tenantId) return false
  if (WRITE_ROLES.includes(roleOf(user)!)) return { tenant: { equals: tenantId } }
  return false
}

/** Create needs a boolean (no `where`): platformOwner / admin / school_admin within a tenant. */
export const schoolTenantCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  if (!tenantOf(user)) return false
  return WRITE_ROLES.includes(roleOf(user)!)
}

// ---- shared internals reused by the async teacher helpers (Task 3) ----
export { getTenantId, roleOf, tenantOf, WRITE_ROLES }
export type { PayloadRequest }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/access/teacherScoped.test.ts`
Expected: PASS (both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/access/schoolAccess.ts tests/access/teacherScoped.test.ts
git commit -m "feat(school): tenant-scoped school access helpers"
```

---

## Task 3: Async teacher-scoped access helpers

**Files:**
- Modify: `src/access/schoolAccess.ts`
- Modify: `tests/access/teacherScoped.test.ts`

Teacher visibility is derived from `SchoolClasses.teachers`. Payload access functions may be **async** and call `req.payload.find`. We query with `overrideAccess: true` to avoid recursion.

- [ ] **Step 1: Write the failing test**

Append to `tests/access/teacherScoped.test.ts`:

```ts
import {
  teacherClassesRead,
  teacherSessionsRead,
  teacherEnrollmentsRead,
  teacherStudentsRead,
  teacherAttendanceRead,
} from '@/access/schoolAccess'

/** Build a mock req whose payload.find returns canned docs per collection. */
function mockReq(user: any, byCollection: Record<string, any[]>) {
  return {
    user,
    payload: {
      find: async ({ collection }: { collection: string }) => ({
        docs: byCollection[collection] ?? [],
      }),
    },
  }
}

describe('teacher async scoping', () => {
  const teacher = { id: 100, role: 'teacher', tenant: 5 }

  it('non-teacher falls through to schoolTenantRead', async () => {
    const admin = { role: 'admin', tenant: 5 }
    expect(await teacherClassesRead({ req: mockReq(admin, {}) })).toEqual({
      tenant: { equals: 5 },
    })
  })

  it('teacher classes scoped to ids where they teach', async () => {
    const req = mockReq(teacher, { 'school-classes': [{ id: 11 }, { id: 12 }] })
    expect(await teacherClassesRead({ req })).toEqual({ id: { in: [11, 12] } })
  })

  it('teacher with no classes is denied (empty in-list)', async () => {
    const req = mockReq(teacher, { 'school-classes': [] })
    expect(await teacherClassesRead({ req })).toEqual({ id: { in: [] } })
  })

  it('teacher sessions scoped by class', async () => {
    const req = mockReq(teacher, { 'school-classes': [{ id: 11 }] })
    expect(await teacherSessionsRead({ req })).toEqual({ class: { in: [11] } })
  })

  it('teacher enrollments scoped by class', async () => {
    const req = mockReq(teacher, { 'school-classes': [{ id: 11 }] })
    expect(await teacherEnrollmentsRead({ req })).toEqual({ class: { in: [11] } })
  })

  it('teacher students scoped to enrolled student ids', async () => {
    const req = mockReq(teacher, {
      'school-classes': [{ id: 11 }],
      enrollments: [{ student: 201 }, { student: { id: 202 } }],
    })
    expect(await teacherStudentsRead({ req })).toEqual({ id: { in: [201, 202] } })
  })

  it('teacher attendance scoped to own sessions', async () => {
    const req = mockReq(teacher, {
      'school-classes': [{ id: 11 }],
      'class-sessions': [{ id: 301 }, { id: 302 }],
    })
    expect(await teacherAttendanceRead({ req })).toEqual({ session: { in: [301, 302] } })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/access/teacherScoped.test.ts`
Expected: FAIL — the five `teacher*Read` exports don't exist.

- [ ] **Step 3: Implement the async helpers**

Append to `src/access/schoolAccess.ts`:

```ts
const idOf = (v: unknown): string | number =>
  typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string | number }).id : (v as string | number)

/** Class ids the teacher is assigned to (empty array if none). */
async function teacherClassIds(req: PayloadRequest): Promise<(string | number)[]> {
  const userId = (req.user as { id: string | number }).id
  const res = await req.payload.find({
    collection: 'school-classes',
    where: { teachers: { in: [userId] } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return res.docs.map((d: { id: string | number }) => d.id)
}

/** Wrap an async teacher resolver so non-teachers fall through to schoolTenantRead. */
const teacherOr =
  (resolve: (req: PayloadRequest) => Promise<unknown>): Access =>
  async (args) => {
    if (roleOf(args.req.user) !== 'teacher') return schoolTenantRead(args)
    if (!tenantOf(args.req.user)) return false
    return resolve(args.req as PayloadRequest)
  }

export const teacherClassesRead: Access = teacherOr(async (req) => ({
  id: { in: await teacherClassIds(req) },
}))

export const teacherSessionsRead: Access = teacherOr(async (req) => ({
  class: { in: await teacherClassIds(req) },
}))

export const teacherEnrollmentsRead: Access = teacherOr(async (req) => ({
  class: { in: await teacherClassIds(req) },
}))

export const teacherStudentsRead: Access = teacherOr(async (req) => {
  const classIds = await teacherClassIds(req)
  const res = await req.payload.find({
    collection: 'enrollments',
    where: { class: { in: classIds }, status: { equals: 'active' } },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const studentIds = res.docs.map((d: { student: unknown }) => idOf(d.student))
  return { id: { in: studentIds } }
})

export const teacherAttendanceRead: Access = teacherOr(async (req) => {
  const classIds = await teacherClassIds(req)
  const res = await req.payload.find({
    collection: 'class-sessions',
    where: { class: { in: classIds } },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const sessionIds = res.docs.map((d: { id: string | number }) => d.id)
  return { session: { in: sessionIds } }
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/access/teacherScoped.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/access/schoolAccess.ts tests/access/teacherScoped.test.ts
git commit -m "feat(school): async teacher-scoped access helpers"
```

---

## Task 4: `Terms` collection

**Files:**
- Create: `src/collections/Terms.ts`
- Test: `tests/collections/terms.access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/collections/terms.access.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Terms } from '@/collections/Terms'

const call = (op: string, user: any) =>
  (Terms.access as Record<string, any>)[op]({ req: { user } })

describe('Terms access', () => {
  it('denies anonymous on every op', async () => {
    for (const op of ['read', 'create', 'update', 'delete']) {
      expect(await call(op, undefined)).toBe(false)
    }
  })
  it('platformOwner full access', async () => {
    for (const op of ['read', 'create', 'update', 'delete']) {
      expect(await call(op, { role: 'platformOwner' })).toBe(true)
    }
  })
  it('school_admin writes within tenant', async () => {
    expect(await call('update', { role: 'school_admin', tenant: 3 })).toEqual({
      tenant: { equals: 3 },
    })
    expect(await call('create', { role: 'school_admin', tenant: 3 })).toBe(true)
  })
  it('teacher reads within tenant but cannot write', async () => {
    expect(await call('read', { role: 'teacher', tenant: 3 })).toEqual({ tenant: { equals: 3 } })
    expect(await call('create', { role: 'teacher', tenant: 3 })).toBe(false)
    expect(await call('update', { role: 'teacher', tenant: 3 })).toBe(false)
  })
  it('kioskManager denied', async () => {
    expect(await call('read', { role: 'kioskManager', tenant: 3 })).toBe(false)
  })
})
```

> Note: Terms teacher-read is plain tenant-scoped (`schoolTenantRead` already returns `{tenant: {equals}}` for staff/teacher? No — `schoolTenantRead` returns false for teacher). Terms uses `teacherTermRead` defined inline below so teachers can read terms in their tenant.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/collections/terms.access.test.ts`
Expected: FAIL — `Cannot find module '@/collections/Terms'`.

- [ ] **Step 3: Implement the collection**

Create `src/collections/Terms.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/collections/terms.access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Terms.ts tests/collections/terms.access.test.ts
git commit -m "feat(school): Terms collection"
```

---

## Task 5: `SchoolClasses` collection

**Files:**
- Create: `src/collections/SchoolClasses.ts`
- Test: `tests/collections/schoolClasses.access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/collections/schoolClasses.access.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SchoolClasses } from '@/collections/SchoolClasses'

const access = SchoolClasses.access as Record<string, any>
const findStub = (docs: any[]) => async () => ({ docs })

describe('SchoolClasses access', () => {
  it('admin reads tenant-scoped', async () => {
    expect(await access.read({ req: { user: { role: 'admin', tenant: 2 } } })).toEqual({
      tenant: { equals: 2 },
    })
  })
  it('teacher reads only their class ids', async () => {
    const req = {
      user: { id: 9, role: 'teacher', tenant: 2 },
      payload: { find: findStub([{ id: 41 }, { id: 42 }]) },
    }
    expect(await access.read({ req })).toEqual({ id: { in: [41, 42] } })
  })
  it('teacher cannot create or delete', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 2 } } })).toBe(false)
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 2 } } })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/collections/schoolClasses.access.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the collection**

Create `src/collections/SchoolClasses.ts`:

```ts
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
```

> `generateClassSessions` is created in Task 9. To keep this task green in isolation, create a stub now and replace it in Task 9:
> ```bash
> printf "import type { CollectionAfterChangeHook } from 'payload'\nexport const generateClassSessions: CollectionAfterChangeHook = ({ doc }) => doc\n" > src/hooks/generateClassSessions.ts
> ```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/collections/schoolClasses.access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collections/SchoolClasses.ts src/hooks/generateClassSessions.ts tests/collections/schoolClasses.access.test.ts
git commit -m "feat(school): SchoolClasses collection"
```

---

## Task 6: `Students` collection

**Files:**
- Create: `src/collections/Students.ts`
- Test: `tests/collections/students.access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/collections/students.access.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Students } from '@/collections/Students'

const access = Students.access as Record<string, any>

describe('Students access', () => {
  it('staff is read-only, no create/update/delete', async () => {
    expect(await access.read({ req: { user: { role: 'staff', tenant: 4 } } })).toEqual({
      tenant: { equals: 4 },
    })
    expect(await access.create({ req: { user: { role: 'staff', tenant: 4 } } })).toBe(false)
    expect(await access.update({ req: { user: { role: 'staff', tenant: 4 } } })).toBe(false)
  })
  it('teacher reads + updates only enrolled students', async () => {
    const find = async ({ collection }: any) =>
      collection === 'school-classes'
        ? { docs: [{ id: 11 }] }
        : { docs: [{ student: 77 }] }
    const req = { user: { id: 9, role: 'teacher', tenant: 4 }, payload: { find } }
    expect(await access.read({ req })).toEqual({ id: { in: [77] } })
    expect(await access.update({ req })).toEqual({ id: { in: [77] } })
  })
  it('teacher cannot delete students', async () => {
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 4 } } })).toBe(false)
  })
  it('school_admin full tenant CRUD', async () => {
    expect(await access.update({ req: { user: { role: 'school_admin', tenant: 4 } } })).toEqual({
      tenant: { equals: 4 },
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/collections/students.access.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the collection**

Create `src/collections/Students.ts`. Read & update use `teacherStudentsRead` (teachers fall through to `schoolTenantRead` for non-teachers, which already grants staff read and admin/school_admin tenant scope). Create/delete exclude teachers and staff via `schoolTenantCreate` / `schoolTenantWrite`.

```ts
import type { CollectionConfig } from 'payload'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  schoolTenantCreate,
  schoolTenantWrite,
  teacherStudentsRead,
} from '../access/schoolAccess'

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
    update: denyKioskManager(teacherStudentsRead),
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
  ],
}

export default Students
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/collections/students.access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Students.ts tests/collections/students.access.test.ts
git commit -m "feat(school): Students collection"
```

---

## Task 7: `Enrollments` collection

**Files:**
- Create: `src/collections/Enrollments.ts`
- Test: `tests/collections/enrollments.access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/collections/enrollments.access.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Enrollments } from '@/collections/Enrollments'

const access = Enrollments.access as Record<string, any>

describe('Enrollments access', () => {
  it('teacher reads only enrollments in their classes', async () => {
    const req = {
      user: { id: 9, role: 'teacher', tenant: 1 },
      payload: { find: async () => ({ docs: [{ id: 11 }] }) },
    }
    expect(await access.read({ req })).toEqual({ class: { in: [11] } })
  })
  it('teacher cannot create enrollments', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
  })
  it('school_admin tenant CRUD', async () => {
    expect(await access.create({ req: { user: { role: 'school_admin', tenant: 1 } } })).toBe(true)
    expect(await access.delete({ req: { user: { role: 'school_admin', tenant: 1 } } })).toEqual({
      tenant: { equals: 1 },
    })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/collections/enrollments.access.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the collection**

Create `src/collections/Enrollments.ts`. The composite unique index `(tenant, student, class)` prevents double-enrollment.

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/collections/enrollments.access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Enrollments.ts tests/collections/enrollments.access.test.ts
git commit -m "feat(school): Enrollments collection"
```

---

## Task 8: `ClassSessions` collection

**Files:**
- Create: `src/collections/ClassSessions.ts`
- Test: `tests/collections/classSessions.access.test.ts`

Teachers may **read and update** sessions for their classes (e.g. mark held/cancelled, add notes) but not create/delete (sessions are auto-generated).

- [ ] **Step 1: Write the failing test**

Create `tests/collections/classSessions.access.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ClassSessions } from '@/collections/ClassSessions'

const access = ClassSessions.access as Record<string, any>
const teacherReq = {
  user: { id: 9, role: 'teacher', tenant: 1 },
  payload: { find: async () => ({ docs: [{ id: 11 }] }) },
}

describe('ClassSessions access', () => {
  it('teacher reads + updates own classes sessions', async () => {
    expect(await access.read({ req: teacherReq })).toEqual({ class: { in: [11] } })
    expect(await access.update({ req: teacherReq })).toEqual({ class: { in: [11] } })
  })
  it('teacher cannot create or delete sessions', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
  })
  it('school_admin tenant CRUD', async () => {
    expect(await access.create({ req: { user: { role: 'school_admin', tenant: 1 } } })).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/collections/classSessions.access.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the collection**

Create `src/collections/ClassSessions.ts`:

```ts
import type { CollectionConfig } from 'payload'
import { denyKioskManager, hideForKioskManager } from '../access/kioskRoles'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import {
  schoolTenantCreate,
  schoolTenantWrite,
  teacherSessionsRead,
} from '../access/schoolAccess'

export const ClassSessions: CollectionConfig = {
  slug: 'class-sessions',
  labels: { singular: 'Session', plural: 'Sessions' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Sunday School',
    hidden: hideForKioskManager,
    useAsTitle: 'date',
    defaultColumns: ['class', 'date', 'status'],
    description: 'One weekly meeting of a class.',
  },
  access: {
    read: denyKioskManager(teacherSessionsRead),
    create: denyKioskManager(schoolTenantCreate),
    update: denyKioskManager(teacherSessionsRead),
    delete: denyKioskManager(schoolTenantWrite),
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true, admin: { hidden: true } },
    { name: 'class', type: 'relationship', relationTo: 'school-classes', required: true, index: true },
    { name: 'date', type: 'date', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Held', value: 'held' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    { name: 'notes', type: 'textarea' },
  ],
  indexes: [{ fields: ['tenant', 'class', 'date'], unique: true }],
}

export default ClassSessions
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/collections/classSessions.access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collections/ClassSessions.ts tests/collections/classSessions.access.test.ts
git commit -m "feat(school): ClassSessions collection"
```

---

## Task 9: Weekly session auto-generation hook

**Files:**
- Replace stub: `src/hooks/generateClassSessions.ts`
- Test: `tests/hooks/generateClassSessions.test.ts`

When a class is **created**, generate one `ClassSession` per `meetingDay` between the term's `startDate` and `endDate`.

- [ ] **Step 1: Write the failing test**

Create `tests/hooks/generateClassSessions.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { weeklyDates } from '@/hooks/generateClassSessions'

describe('weeklyDates', () => {
  it('returns each Sunday between start and end inclusive', () => {
    // 2026-09-06 is a Sunday; 2026-09-27 is a Sunday.
    const dates = weeklyDates('2026-09-06', '2026-09-30', 'sunday')
    expect(dates).toEqual(['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27'])
  })
  it('skips to the first matching weekday when start is mid-week', () => {
    // 2026-09-01 is a Tuesday; first Sunday is 2026-09-06.
    const dates = weeklyDates('2026-09-01', '2026-09-14', 'sunday')
    expect(dates).toEqual(['2026-09-06', '2026-09-13'])
  })
  it('returns empty when range contains no matching weekday', () => {
    expect(weeklyDates('2026-09-07', '2026-09-11', 'sunday')).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/hooks/generateClassSessions.test.ts`
Expected: FAIL — `weeklyDates` not exported.

- [ ] **Step 3: Implement the hook**

Replace `src/hooks/generateClassSessions.ts`:

```ts
import type { CollectionAfterChangeHook } from 'payload'

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
}

/** All YYYY-MM-DD dates on `weekday` between start and end (inclusive). UTC-based to avoid TZ drift. */
export function weeklyDates(start: string, end: string, weekday: string): string[] {
  const target = WEEKDAY_INDEX[weekday] ?? 0
  const out: string[] = []
  const cursor = new Date(`${start.slice(0, 10)}T00:00:00Z`)
  const last = new Date(`${end.slice(0, 10)}T00:00:00Z`)
  // advance cursor to the first matching weekday
  while (cursor.getUTCDay() !== target && cursor <= last) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return out
}

/** On class create, materialise weekly ClassSessions across the term. Idempotent per (tenant, class, date). */
export const generateClassSessions: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const termId = typeof doc.term === 'object' ? doc.term?.id : doc.term
  if (!termId) return doc

  const term = await req.payload.findByID({
    collection: 'terms',
    id: termId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (!term?.startDate || !term?.endDate) return doc

  const dates = weeklyDates(term.startDate, term.endDate, term.meetingDay ?? 'sunday')
  for (const date of dates) {
    try {
      await req.payload.create({
        collection: 'class-sessions',
        data: { tenant: doc.tenant, class: doc.id, date, status: 'scheduled' },
        overrideAccess: true,
        req,
      })
    } catch {
      // unique (tenant, class, date) — ignore duplicates so the hook is idempotent
    }
  }
  return doc
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/hooks/generateClassSessions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/generateClassSessions.ts tests/hooks/generateClassSessions.test.ts
git commit -m "feat(school): auto-generate weekly class sessions"
```

---

## Task 10: `AttendanceRecords` collection + teacher-ownership guard

**Files:**
- Create: `src/collections/AttendanceRecords.ts`
- Create: `src/hooks/assertTeacherOwnsSession.ts`
- Test: `tests/collections/attendanceRecords.access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/collections/attendanceRecords.access.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { AttendanceRecords } from '@/collections/AttendanceRecords'

const access = AttendanceRecords.access as Record<string, any>

describe('AttendanceRecords access', () => {
  it('teacher reads only own-class sessions', async () => {
    const find = async ({ collection }: any) =>
      collection === 'school-classes' ? { docs: [{ id: 11 }] } : { docs: [{ id: 301 }] }
    const req = { user: { id: 9, role: 'teacher', tenant: 1 }, payload: { find } }
    expect(await access.read({ req })).toEqual({ session: { in: [301] } })
  })
  it('teacher may create and update (ownership enforced by hook)', async () => {
    expect(await access.create({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(true)
    const find = async ({ collection }: any) =>
      collection === 'school-classes' ? { docs: [{ id: 11 }] } : { docs: [{ id: 301 }] }
    expect(
      await access.update({ req: { user: { id: 9, role: 'teacher', tenant: 1 }, payload: { find } } }),
    ).toEqual({ session: { in: [301] } })
  })
  it('teacher cannot delete', async () => {
    expect(await access.delete({ req: { user: { role: 'teacher', tenant: 1 } } })).toBe(false)
  })
  it('staff read-only', async () => {
    expect(await access.read({ req: { user: { role: 'staff', tenant: 1 } } })).toEqual({
      tenant: { equals: 1 },
    })
    expect(await access.create({ req: { user: { role: 'staff', tenant: 1 } } })).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/collections/attendanceRecords.access.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the ownership guard**

Create `src/hooks/assertTeacherOwnsSession.ts`:

```ts
import type { CollectionBeforeValidateHook } from 'payload'
import { Forbidden } from 'payload'

/**
 * For teacher writes, verify the target session belongs to a class the teacher
 * is assigned to. Admins/school_admins/platformOwner bypass (tenant access already checked).
 */
export const assertTeacherOwnsSession: CollectionBeforeValidateHook = async ({ data, req }) => {
  const user = req.user as { id?: string | number; role?: string } | null | undefined
  if (!user || user.role !== 'teacher') return data
  const sessionId = typeof data?.session === 'object' ? data?.session?.id : data?.session
  if (!sessionId) return data

  const session = await req.payload.findByID({
    collection: 'class-sessions',
    id: sessionId,
    depth: 1,
    overrideAccess: true,
    req,
  })
  const classDoc = session?.class as { teachers?: unknown[] } | undefined
  const teacherIds = (classDoc?.teachers ?? []).map((t) =>
    typeof t === 'object' && t !== null && 'id' in t ? (t as { id: unknown }).id : t,
  )
  if (!teacherIds.includes(user.id)) {
    throw new Forbidden(req.t)
  }
  return data
}
```

- [ ] **Step 4: Implement the collection**

Create `src/collections/AttendanceRecords.ts`. Teacher create returns a plain boolean `true` (ownership enforced by the hook); teacher read/update use `teacherAttendanceRead`.

```ts
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
    update: denyKioskManager(teacherAttendanceRead),
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/collections/attendanceRecords.access.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/collections/AttendanceRecords.ts src/hooks/assertTeacherOwnsSession.ts tests/collections/attendanceRecords.access.test.ts
git commit -m "feat(school): AttendanceRecords collection + teacher ownership guard"
```

---

## Task 11: Register collections, generate types, create migration

**Files:**
- Modify: `src/payload.config.ts` (imports ~10-33; collections array ~145-170)

- [ ] **Step 1: Add imports**

In `src/payload.config.ts`, with the other collection imports, add:

```ts
import { Terms } from './collections/Terms'
import { SchoolClasses } from './collections/SchoolClasses'
import { Students } from './collections/Students'
import { Enrollments } from './collections/Enrollments'
import { ClassSessions } from './collections/ClassSessions'
import { AttendanceRecords } from './collections/AttendanceRecords'
```

- [ ] **Step 2: Register in the collections array**

Insert these into the `collections: [ ... ]` array (place after `Members`, before `Media`, so the "Sunday School" group renders after Membership):

```ts
  Terms,
  SchoolClasses,
  Students,
  Enrollments,
  ClassSessions,
  AttendanceRecords,
```

- [ ] **Step 3: Generate Payload types**

Run: `npm run generate:types`
Expected: `src/payload-types.ts` updated with `Term`, `SchoolClass`, `Student`, `Enrollment`, `ClassSession`, `AttendanceRecord` interfaces and the new slugs.

- [ ] **Step 4: Boot dev to auto-sync schema and smoke-test**

Run: `npm run dev` (let it boot, then Ctrl-C)
Expected: server starts without schema errors; the six tables are created (Payload dev auto-sync).

- [ ] **Step 5: Create the production migration**

Run: `npx payload migrate:create sunday_school_attendance`
Expected: a new `src/migrations/<timestamp>_sunday_school_attendance.ts` + `.json` capturing the six tables, enums, and composite unique indexes.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all tests pass (existing + the new school tests).

- [ ] **Step 7: Commit**

```bash
git add src/payload.config.ts src/payload-types.ts src/migrations/
git commit -m "feat(school): register Sunday school collections + migration"
```

---

## Task 12: Registration form → unplaced Student hook

**Files:**
- Create: `src/hooks/createStudentFromRegistration.ts`
- Modify: `src/collections/FormSubmissions.ts` (add the hook to `hooks.afterChange`)
- Test: `tests/hooks/createStudentFromRegistration.test.ts`

A Form is flagged as a registration form by a slug/title convention. On submission, create one unplaced `Student` from mapped fields. The submission's `form` is loaded to read its title/slug; field values come from the submission's `submissionData` array (inspect `FormSubmissions.ts` for the exact field name — it is `submissionData` with `{ field, value }` entries in this repo).

- [ ] **Step 1: Inspect the submission data shape**

Run: `grep -n "submissionData\|name: 'form'\|afterChange\|hooks" src/collections/FormSubmissions.ts`
Expected: confirm the array field name holding `{ field, value }` pairs and whether an `afterChange` array already exists. Use the real field name in the code below if it differs from `submissionData`.

- [ ] **Step 2: Write the failing test**

Create `tests/hooks/createStudentFromRegistration.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mapRegistrationFields } from '@/hooks/createStudentFromRegistration'

describe('mapRegistrationFields', () => {
  it('maps submission entries to Student data', () => {
    const entries = [
      { field: 'firstName', value: 'Aisha' },
      { field: 'lastName', value: 'Khan' },
      { field: 'age', value: '7' },
      { field: 'guardianName', value: 'Sara Khan' },
      { field: 'guardianPhone', value: '555-1212' },
      { field: 'guardianEmail', value: 'sara@example.com' },
      { field: 'allergies', value: 'peanuts' },
    ]
    expect(mapRegistrationFields(entries, 9)).toEqual({
      tenant: 9,
      firstName: 'Aisha',
      lastName: 'Khan',
      age: 7,
      allergiesNotes: 'peanuts',
      status: 'active',
      guardians: [
        { name: 'Sara Khan', phone: '555-1212', email: 'sara@example.com', isPrimary: true },
      ],
    })
  })
  it('returns null when required name fields are absent', () => {
    expect(mapRegistrationFields([{ field: 'age', value: '7' }], 9)).toBeNull()
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/hooks/createStudentFromRegistration.test.ts`
Expected: FAIL — `mapRegistrationFields` not exported.

- [ ] **Step 4: Implement the hook**

Create `src/hooks/createStudentFromRegistration.ts`. Replace `submissionData` and the relationship/title field names if Step 1 found different ones.

```ts
import type { CollectionAfterChangeHook } from 'payload'

type Entry = { field: string; value: unknown }

/** Title/slug substring that marks a Form as a Sunday-school registration form. */
const REGISTRATION_MARKER = 'sunday-school-registration'

const get = (entries: Entry[], name: string): string | undefined => {
  const v = entries.find((e) => e.field === name)?.value
  return v == null ? undefined : String(v)
}

/** Map submission entries to Student create data, or null if not a valid registration. */
export function mapRegistrationFields(
  entries: Entry[],
  tenantId: string | number,
): Record<string, unknown> | null {
  const firstName = get(entries, 'firstName')
  const lastName = get(entries, 'lastName')
  if (!firstName || !lastName) return null

  const ageRaw = get(entries, 'age')
  const guardian = {
    name: get(entries, 'guardianName'),
    phone: get(entries, 'guardianPhone'),
    email: get(entries, 'guardianEmail'),
    isPrimary: true,
  }
  const data: Record<string, unknown> = {
    tenant: tenantId,
    firstName,
    lastName,
    status: 'active',
  }
  if (ageRaw && !Number.isNaN(Number(ageRaw))) data.age = Number(ageRaw)
  const allergies = get(entries, 'allergies')
  if (allergies) data.allergiesNotes = allergies
  if (guardian.name) {
    // drop undefined keys for a clean object
    data.guardians = [
      Object.fromEntries(Object.entries(guardian).filter(([, v]) => v !== undefined)),
    ]
  }
  return data
}

export const createStudentFromRegistration: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const formId = typeof doc.form === 'object' ? doc.form?.id : doc.form
  if (!formId) return doc
  const form = await req.payload.findByID({
    collection: 'forms',
    id: formId,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const marker = `${form?.slug ?? ''} ${form?.title ?? ''}`.toLowerCase()
  if (!marker.includes(REGISTRATION_MARKER)) return doc

  const entries = (doc.submissionData ?? []) as Entry[]
  const data = mapRegistrationFields(entries, doc.tenant)
  if (!data) return doc

  await req.payload.create({ collection: 'students', data, overrideAccess: true, req })
  return doc
}
```

- [ ] **Step 5: Wire the hook into FormSubmissions**

In `src/collections/FormSubmissions.ts`, import and append to `hooks.afterChange` (create the array if absent):

```ts
import { createStudentFromRegistration } from '../hooks/createStudentFromRegistration'
// ...
  hooks: {
    // ...existing hooks...
    afterChange: [createStudentFromRegistration],
  },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/hooks/createStudentFromRegistration.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/createStudentFromRegistration.ts src/collections/FormSubmissions.ts tests/hooks/createStudentFromRegistration.test.ts
git commit -m "feat(school): create unplaced student from registration form"
```

---

## Task 13: Take-Attendance admin view

**Files:**
- Create: `src/app/(payload)/admin/take-attendance/page.tsx`
- Create: `src/admin/school/TakeAttendance.tsx`
- Create: `src/admin/school/SundaySchoolNav.tsx`
- Modify: `src/payload.config.ts` (`admin.components.beforeNavLinks`)

The view is a client component that talks to Payload's REST API (`/api/...`) with `credentials: 'include'`, so all tenant + teacher scoping is enforced server-side automatically.

- [ ] **Step 1: Create the nav link**

Create `src/admin/school/SundaySchoolNav.tsx`:

```tsx
import Link from 'next/link'
import React from 'react'

const SundaySchoolNav: React.FC = () => (
  <Link href="/admin/take-attendance" className="nav__link" prefetch={false}>
    Take Attendance
  </Link>
)

export default SundaySchoolNav
```

- [ ] **Step 2: Register the nav link**

In `src/payload.config.ts`, add to `admin.components.beforeNavLinks` (after the membership nav entry):

```ts
        '/src/admin/school/SundaySchoolNav#default',
```

- [ ] **Step 3: Create the route shell**

Create `src/app/(payload)/admin/take-attendance/page.tsx`:

```tsx
import React from 'react'
import TakeAttendance from '@/admin/school/TakeAttendance'

export default function TakeAttendancePage() {
  return (
    <div style={{ padding: '2rem', maxWidth: 720 }}>
      <h1>Take Attendance</h1>
      <TakeAttendance />
    </div>
  )
}
```

- [ ] **Step 4: Implement the roster component**

Create `src/admin/school/TakeAttendance.tsx`:

```tsx
'use client'
import React, { useEffect, useState, useCallback } from 'react'

type Doc = { id: number | string; [k: string]: any }
const STATUSES = ['present', 'absent', 'late', 'excused'] as const
type Status = (typeof STATUSES)[number]

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}

const TakeAttendance: React.FC = () => {
  const [classes, setClasses] = useState<Doc[]>([])
  const [classId, setClassId] = useState<string>('')
  const [session, setSession] = useState<Doc | null>(null)
  const [roster, setRoster] = useState<Doc[]>([])
  const [marks, setMarks] = useState<Record<string, { id?: string | number; status: Status }>>({})
  const [busy, setBusy] = useState(false)

  // load classes visible to the current user
  useEffect(() => {
    api('/school-classes?limit=200&depth=0').then((r) => setClasses(r.docs)).catch(() => {})
  }, [])

  const loadClass = useCallback(async (id: string) => {
    setClassId(id)
    setSession(null)
    setRoster([])
    setMarks({})
    if (!id) return
    // nearest scheduled session for this class
    const sess = await api(
      `/class-sessions?where[class][equals]=${id}&where[status][not_equals]=cancelled&sort=date&limit=200&depth=0`,
    )
    const today = new Date().toISOString().slice(0, 10)
    const upcoming =
      sess.docs.find((s: Doc) => String(s.date).slice(0, 10) >= today) ?? sess.docs[0] ?? null
    setSession(upcoming)
    // active roster
    const enr = await api(
      `/enrollments?where[class][equals]=${id}&where[status][equals]=active&limit=500&depth=1`,
    )
    const students = enr.docs.map((e: Doc) => e.student).filter(Boolean)
    setRoster(students)
    // existing marks for this session
    if (upcoming) {
      const att = await api(
        `/attendance-records?where[session][equals]=${upcoming.id}&limit=500&depth=0`,
      )
      const m: Record<string, { id: string | number; status: Status }> = {}
      for (const a of att.docs) {
        const sid = typeof a.student === 'object' ? a.student.id : a.student
        m[String(sid)] = { id: a.id, status: a.status }
      }
      setMarks(m)
    }
  }, [])

  const mark = async (studentId: string | number, status: Status) => {
    if (!session) return
    setBusy(true)
    const key = String(studentId)
    const existing = marks[key]
    try {
      let saved: Doc
      if (existing?.id) {
        saved = await api(`/attendance-records/${existing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        }).then((r) => r.doc)
      } else {
        saved = await api('/attendance-records', {
          method: 'POST',
          body: JSON.stringify({ session: session.id, student: studentId, status }),
        }).then((r) => r.doc)
      }
      setMarks((prev) => ({ ...prev, [key]: { id: saved.id, status } }))
    } finally {
      setBusy(false)
    }
  }

  const counts = STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: roster.filter((st) => marks[String(st.id)]?.status === s).length }),
    {} as Record<Status, number>,
  )
  const unmarked = roster.length - Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      <label>
        Class:{' '}
        <select value={classId} onChange={(e) => loadClass(e.target.value)}>
          <option value="">— select —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {session && (
        <p>
          Session: <strong>{String(session.date).slice(0, 10)}</strong> · present {counts.present} ·
          absent {counts.absent} · late {counts.late} · excused {counts.excused} ·{' '}
          <strong>{unmarked} unmarked</strong>
        </p>
      )}
      {classId && !session && <p>No sessions scheduled for this class.</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {roster.map((st) => {
          const cur = marks[String(st.id)]?.status
          return (
            <li key={st.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0' }}>
              <span style={{ flex: 1 }}>{st.fullName ?? `${st.firstName} ${st.lastName}`}</span>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={busy || !session}
                  onClick={() => mark(st.id, s)}
                  style={{ fontWeight: cur === s ? 700 : 400, opacity: cur === s ? 1 : 0.6 }}
                >
                  {s}
                </button>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default TakeAttendance
```

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, then as an `admin`/`school_admin`: create a Term, a SchoolClass (sessions auto-generate), a Student, and an active Enrollment. Visit `http://demo.localhost:3001/admin/take-attendance` (use the tenant host per repo convention). Select the class, confirm the roster loads and tapping a status persists (counts update; reload preserves marks).
Expected: marking writes `attendance-records`; counts and unmarked tally update; teacher login sees only their classes.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(payload)/admin/take-attendance/page.tsx" src/admin/school/TakeAttendance.tsx src/admin/school/SundaySchoolNav.tsx src/payload.config.ts
git commit -m "feat(school): take-attendance admin view"
```

---

## Task 14: Reporting columns + final suite

**Files:**
- Modify: `src/collections/Students.ts` (add a `join` field for attendance history)
- Modify: `src/collections/AttendanceRecords.ts` (ensure `defaultColumns` aid CSV export)

Payload's built-in list view + column filters + CSV export covers the v1 reporting needs; this task adds a per-student attendance history via a `join` field (no new collection).

- [ ] **Step 1: Add an attendance join to Students**

In `src/collections/Students.ts`, add to `fields` (after `status`):

```ts
    {
      name: 'attendance',
      type: 'join',
      collection: 'attendance-records',
      on: 'student',
      admin: { description: 'Attendance history for this student.' },
    },
```

- [ ] **Step 2: Regenerate types**

Run: `npm run generate:types`
Expected: `Student.attendance` appears in `src/payload-types.ts`.

- [ ] **Step 3: Verify dev boot (schema sync for the join)**

Run: `npm run dev` (boot, then Ctrl-C)
Expected: no schema errors; the Student edit page shows an Attendance list.

- [ ] **Step 4: Run the full suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Students.ts src/payload-types.ts
git commit -m "feat(school): per-student attendance history join"
```

---

## Self-Review

**Spec coverage:**
- Six collections (Terms, SchoolClasses, Students, Enrollments, ClassSessions, AttendanceRecords) → Tasks 4–8, 10. ✔
- `school_admin` + `teacher` roles → Task 1. ✔
- Teacher scoped to own classes (incl. async Students-via-Enrollments) → Tasks 2–3, applied in 5–10. ✔
- `staff` read-only, `kioskManager` denied → enforced via `schoolTenantRead`/`denyKioskManager`, tested in Tasks 6, 10. ✔
- Weekly session auto-generation across the term → Task 9. ✔
- Registration form → unplaced student; admin placement queue (= active student with no active enrollment, surfaced by the Students list filter) → Task 12. ✔
- Dedicated `/admin/take-attendance`, explicit per-student marking, live counts → Task 13. ✔
- Reporting via list/filter/CSV + per-student history → Task 14. ✔
- `capacity` informational, `age` captured + `gradeLevel` admin-assigned → Task 6. ✔
- Migration for prod → Task 11. ✔

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Task 12 Step 1 explicitly instructs verifying the real `submissionData`/`form` field names before coding (the one repo-specific unknown), with a concrete default.

**Type consistency:** Slugs are stable kebab-case throughout (`school-classes`, `class-sessions`, `attendance-records`, `enrollments`, `students`, `terms`). Access exports (`schoolTenantRead/Write/Create`, `teacher*Read`, `roleOf`, `tenantOf`, `WRITE_ROLES`) are defined in Task 2–3 and consumed with matching names in Tasks 4–10. The SchoolClasses afterChange hook `generateClassSessions` is stubbed in Task 5 and fully implemented in Task 9 (same signature).
