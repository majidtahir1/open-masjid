# Program-Scoped school_admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope `school_admin` to only the programs they're assigned (`managedPrograms`), giving full access within those programs and none outside — leaving `admin` (tenant-wide), `teacher` (class-scoped), and `staff` (read-only) unchanged.

**Architecture:** Add `managedPrograms` to Users. Add async program-scoped resolvers + `readByRole`/`writeByRole` composition to `src/access/schoolAccess.ts` (parallel to the existing teacher helpers). Rewire the six school collections' access through the composition, gate creates, and add `beforeValidate` guards so a school_admin can't write into a program they don't manage.

**Tech Stack:** Payload CMS 3.84, Postgres (hasMany relationship → join table), TypeScript, Vitest.

---

## Context the implementer needs

- **Current access** (`src/access/schoolAccess.ts`): `schoolTenantRead`/`schoolTenantWrite`/`schoolTenantCreate` treat `school_admin` as tenant-wide (it's in `WRITE_ROLES`). The async `teacher*Read` helpers use `teacherOr` (teacher → class-scoped `where`; else → `schoolTenantRead`).
- **Collection wiring today** (`access: { read, create, update, delete }`): read uses a `teacher*Read`; create uses `schoolTenantCreate`; update uses `schoolTenantWrite` or a dedicated `*Update` (Students→`teacherStudentsUpdate`, ClassSessions→`sessionUpdate`, AttendanceRecords→`attendanceUpdate`); delete uses `schoolTenantWrite`.
- **The guard** `src/hooks/assertTeacherOwnsSession.ts` (beforeValidate on AttendanceRecords) currently lets school_admin BYPASS — that must change (school_admin gets scoped, not bypassed).
- **`req.user.managedPrograms`** is loaded with the authenticated user (relationship array of ids or `{id}`), so the program ids need no query; resolving their *classes/sessions/students* does (via `req.payload.find`, `overrideAccess: true`).
- Tests follow the existing style: call the access fn with a mock `req` (`tests/collections/*.access.test.ts`), mocking `req.payload.find` where the resolver queries.
- Migrations: additive hasMany → `npx payload migrate:create` (non-interactive), user applies.

---

## Task 1: Users `managedPrograms` field + migration

**Files:**
- Modify: `src/collections/Users.ts`

- [ ] **Step 1: Add the field**

In `src/collections/Users.ts`, add to the `fields` array (after the `tenant` field is fine):

```ts
    {
      name: 'managedPrograms',
      type: 'relationship',
      relationTo: 'terms',
      hasMany: true,
      index: true,
      admin: {
        description: 'Programs this School Admin manages. They get full access to the classes, students, and attendance within these programs only.',
        condition: (data) => data?.role === 'school_admin',
      },
    },
```

- [ ] **Step 2: Typecheck + types + migration**

Run `npx tsc --noEmit` (clean), `npm run generate:types` (expect `User.managedPrograms`).
Then `npx payload migrate:create user_managed_programs` (additive hasMany → a `users_managed_programs` join table; should not prompt). Inspect: only `CREATE TABLE "users_managed_programs"` + FK/indexes, no drops; `.json` snapshot created and registered in `src/migrations/index.ts`. Do NOT run `npx payload migrate`.

- [ ] **Step 3: Suite + commit**

Run `npm test` (all pass). Then:
```bash
git add src/collections/Users.ts src/payload-types.ts src/migrations/
git commit -m "feat(access): managedPrograms on users for program-scoped school_admin"
```

---

## Task 2: Program-scoped resolvers + role composition

**Files:**
- Modify: `src/access/schoolAccess.ts`
- Test: `tests/access/schoolAdminScoped.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/access/schoolAdminScoped.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  managedProgramIds, schoolAdminTermsRead, schoolAdminClassesRead, schoolAdminSessionsRead,
  schoolAdminStudentsRead, readByRole, writeByRole, schoolAdminCreate, adminOnlyCreate,
} from '@/access/schoolAccess'

const sa = (managed: any[]) => ({ id: 9, role: 'school_admin', tenant: 1, managedPrograms: managed })
function reqWith(user: any, byCollection: Record<string, any[]> = {}) {
  return { user, payload: { find: async ({ collection }: any) => ({ docs: byCollection[collection] ?? [] }) } } as any
}

describe('managedProgramIds', () => {
  it('normalizes ids and objects', () => {
    expect(managedProgramIds({ managedPrograms: [10, { id: 11 }] })).toEqual([10, 11])
  })
  it('empty when none', () => {
    expect(managedProgramIds({})).toEqual([])
  })
})

describe('school_admin resolvers', () => {
  it('terms read scoped to managed program ids', async () => {
    expect(await schoolAdminTermsRead({ req: reqWith(sa([10, 11])) } as any)).toEqual({ id: { in: [10, 11] } })
  })
  it('classes read scoped by term', async () => {
    expect(await schoolAdminClassesRead({ req: reqWith(sa([10])) } as any)).toEqual({ term: { in: [10] } })
  })
  it('sessions read scoped by the programs’ classes', async () => {
    const req = reqWith(sa([10]), { 'school-classes': [{ id: 41 }, { id: 42 }] })
    expect(await schoolAdminSessionsRead({ req } as any)).toEqual({ class: { in: [41, 42] } })
  })
  it('students read = enrolled in their classes OR registered for their programs', async () => {
    const req = reqWith(sa([10]), { 'school-classes': [{ id: 41 }], enrollments: [{ student: 77 }] })
    expect(await schoolAdminStudentsRead({ req } as any)).toEqual({ or: [{ id: { in: [77] } }, { registeredProgram: { in: [10] } }] })
  })
  it('empty managed → matches nothing', async () => {
    expect(await schoolAdminTermsRead({ req: reqWith(sa([])) } as any)).toEqual({ id: { in: [] } })
  })
})

describe('readByRole / writeByRole', () => {
  const teacherRes = async () => ({ id: { in: [1] } })
  const saRes = async () => ({ id: { in: [2] } })
  const read = readByRole({ teacher: teacherRes, schoolAdmin: saRes })
  const write = writeByRole({ schoolAdmin: saRes })
  it('platformOwner → true', async () => {
    expect(await read({ req: reqWith({ role: 'platformOwner' }) } as any)).toBe(true)
  })
  it('teacher → teacher resolver', async () => {
    expect(await read({ req: reqWith({ role: 'teacher', tenant: 1 }) } as any)).toEqual({ id: { in: [1] } })
  })
  it('school_admin → schoolAdmin resolver', async () => {
    expect(await read({ req: reqWith({ role: 'school_admin', tenant: 1 }) } as any)).toEqual({ id: { in: [2] } })
  })
  it('admin → tenant read', async () => {
    expect(await read({ req: reqWith({ role: 'admin', tenant: 1 }) } as any)).toEqual({ tenant: { equals: 1 } })
  })
  it('staff → tenant read but write denied', async () => {
    expect(await read({ req: reqWith({ role: 'staff', tenant: 1 }) } as any)).toEqual({ tenant: { equals: 1 } })
    expect(await write({ req: reqWith({ role: 'staff', tenant: 1 }) } as any)).toBe(false)
  })
  it('write: school_admin → resolver, admin → tenant', async () => {
    expect(await write({ req: reqWith({ role: 'school_admin', tenant: 1 }) } as any)).toEqual({ id: { in: [2] } })
    expect(await write({ req: reqWith({ role: 'admin', tenant: 1 }) } as any)).toEqual({ tenant: { equals: 1 } })
  })
})

describe('create gates', () => {
  it('adminOnlyCreate: admin/platformOwner yes, school_admin no', () => {
    expect(adminOnlyCreate({ req: reqWith({ role: 'platformOwner' }) } as any)).toBe(true)
    expect(adminOnlyCreate({ req: reqWith({ role: 'admin', tenant: 1 }) } as any)).toBe(true)
    expect(adminOnlyCreate({ req: reqWith(sa([10])) } as any)).toBe(false)
  })
  it('schoolAdminCreate: school_admin only with managed programs', () => {
    expect(schoolAdminCreate({ req: reqWith(sa([10])) } as any)).toBe(true)
    expect(schoolAdminCreate({ req: reqWith(sa([])) } as any)).toBe(false)
    expect(schoolAdminCreate({ req: reqWith({ role: 'admin', tenant: 1 }) } as any)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/access/schoolAdminScoped.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement the helpers**

Append to `src/access/schoolAccess.ts`:

```ts
// ---- program-scoped school_admin helpers ----

/** Program (term) ids a school_admin manages — read straight off the user. */
export function managedProgramIds(user: unknown): (string | number)[] {
  const mp = (user as { managedPrograms?: unknown[] } | null | undefined)?.managedPrograms ?? []
  return mp.map((p) => idOf(p))
}

/** Class ids belonging to a school_admin's managed programs (empty if none). */
async function schoolAdminClassIds(req: PayloadRequest): Promise<(string | number)[]> {
  const programIds = managedProgramIds(req.user)
  if (programIds.length === 0) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (req.payload as any).find({
    collection: 'school-classes', where: { term: { in: programIds } }, limit: 5000, depth: 0, overrideAccess: true, req,
  })
  return (res.docs as { id: string | number }[]).map((d) => d.id)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Resolve = (req: PayloadRequest) => Promise<any>

// Teacher resolvers (plain Resolve form, reusing teacherClassIds) so collections
// can compose them via readByRole/writeByRole instead of the teacherOr wrappers.
export const teacherClassesResolve: Resolve = async (req) => ({ id: { in: await teacherClassIds(req) } })
export const teacherSessionsResolve: Resolve = async (req) => ({ class: { in: await teacherClassIds(req) } })
export const teacherEnrollmentsResolve: Resolve = async (req) => ({ class: { in: await teacherClassIds(req) } })
export const teacherStudentsResolve: Resolve = async (req) => {
  const classIds = await teacherClassIds(req)
  let studentIds: (string | number)[] = []
  if (classIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (req.payload as any).find({
      collection: 'enrollments', where: { class: { in: classIds }, status: { equals: 'active' } }, limit: 5000, depth: 0, overrideAccess: true, req,
    })
    studentIds = (res.docs as { student: unknown }[]).map((d) => idOf(d.student))
  }
  return { id: { in: studentIds } }
}
export const teacherAttendanceResolve: Resolve = async (req) => {
  const classIds = await teacherClassIds(req)
  let sessionIds: (string | number)[] = []
  if (classIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (req.payload as any).find({
      collection: 'class-sessions', where: { class: { in: classIds } }, limit: 5000, depth: 0, overrideAccess: true, req,
    })
    sessionIds = (res.docs as { id: string | number }[]).map((d) => d.id)
  }
  return { session: { in: sessionIds } }
}

export const schoolAdminTermsRead: Resolve = async (req) => ({ id: { in: managedProgramIds(req.user) } })
export const schoolAdminClassesRead: Resolve = async (req) => ({ term: { in: managedProgramIds(req.user) } })
export const schoolAdminSessionsRead: Resolve = async (req) => ({ class: { in: await schoolAdminClassIds(req) } })
export const schoolAdminEnrollmentsRead: Resolve = async (req) => ({ class: { in: await schoolAdminClassIds(req) } })

export const schoolAdminStudentsRead: Resolve = async (req) => {
  const programIds = managedProgramIds(req.user)
  const classIds = await schoolAdminClassIds(req)
  let studentIds: (string | number)[] = []
  if (classIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (req.payload as any).find({
      collection: 'enrollments', where: { class: { in: classIds }, status: { equals: 'active' } }, limit: 5000, depth: 0, overrideAccess: true, req,
    })
    studentIds = (res.docs as { student: unknown }[]).map((d) => idOf(d.student))
  }
  return { or: [{ id: { in: studentIds } }, { registeredProgram: { in: programIds } }] }
}

export const schoolAdminAttendanceRead: Resolve = async (req) => {
  const classIds = await schoolAdminClassIds(req)
  let sessionIds: (string | number)[] = []
  if (classIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (req.payload as any).find({
      collection: 'class-sessions', where: { class: { in: classIds } }, limit: 5000, depth: 0, overrideAccess: true, req,
    })
    sessionIds = (res.docs as { id: string | number }[]).map((d) => d.id)
  }
  return { session: { in: sessionIds } }
}

/** Compose read access: platformOwner all; teacher/school_admin via resolvers; admin/staff tenant read. */
export function readByRole(opts: { teacher?: Resolve; schoolAdmin?: Resolve }): Access {
  return async (args) => {
    const role = roleOf(args.req.user)
    if (role === 'platformOwner') return true
    if (role === 'teacher') return opts.teacher && tenantOf(args.req.user) ? opts.teacher(args.req as PayloadRequest) : false
    if (role === 'school_admin') return opts.schoolAdmin && tenantOf(args.req.user) ? opts.schoolAdmin(args.req as PayloadRequest) : false
    return schoolTenantRead(args)
  }
}

/** Compose write access (update/delete): teacher/school_admin via resolvers; admin tenant; staff/none denied. */
export function writeByRole(opts: { teacher?: Resolve; schoolAdmin?: Resolve }): Access {
  return async (args) => {
    const role = roleOf(args.req.user)
    if (role === 'platformOwner') return true
    if (role === 'teacher') return opts.teacher && tenantOf(args.req.user) ? opts.teacher(args.req as PayloadRequest) : false
    if (role === 'school_admin') return opts.schoolAdmin && tenantOf(args.req.user) ? opts.schoolAdmin(args.req as PayloadRequest) : false
    return schoolTenantWrite(args)
  }
}

/** Create gate for programs (terms): admin/platformOwner only. */
export const adminOnlyCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  if (roleOf(user) === 'admin') return Boolean(tenantOf(user))
  return false
}

/** Create gate for classes/enrollments/sessions/students: admin or a school_admin who manages ≥1 program. */
export const schoolAdminCreate: Access = ({ req: { user } }) => {
  if (!user) return false
  if (roleOf(user) === 'platformOwner') return true
  if (roleOf(user) === 'admin') return Boolean(tenantOf(user))
  if (roleOf(user) === 'school_admin') return managedProgramIds(user).length > 0
  return false
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/access/schoolAdminScoped.test.ts` → PASS. `npm test` → all pass. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/access/schoolAccess.ts tests/access/schoolAdminScoped.test.ts
git commit -m "feat(access): program-scoped school_admin resolvers + role composition"
```

---

## Task 3: Scope guards (generalize the session guard, add the class/enrollment guard)

**Files:**
- Modify: `src/hooks/assertTeacherOwnsSession.ts` → rename export to `assertSessionScope` (keep the file or rename; keep a re-export for AttendanceRecords)
- Create: `src/hooks/assertProgramScope.ts`
- Test: `tests/hooks/programScope.test.ts`

- [ ] **Step 1: Generalize the session guard**

Replace `src/hooks/assertTeacherOwnsSession.ts` contents with a guard that scopes BOTH teacher and school_admin (admins/platformOwner bypass):

```ts
import type { CollectionBeforeValidateHook } from 'payload'
import { Forbidden } from 'payload'

/* eslint-disable @typescript-eslint/no-explicit-any */
const idOf = (v: unknown) => (typeof v === 'object' && v !== null && 'id' in v ? (v as { id: unknown }).id : v)

/**
 * Scope attendance writes to the actor's allowed sessions:
 * - teacher: the session's class must list them in `teachers`
 * - school_admin: the session's class's `term` must be in their managedPrograms
 * - admin / platformOwner: bypass (tenant access already checked)
 */
export const assertSessionScope: CollectionBeforeValidateHook = async ({ data, req }) => {
  const user = req.user as { id?: string | number; role?: string; managedPrograms?: unknown[] } | null | undefined
  if (!user || (user.role !== 'teacher' && user.role !== 'school_admin')) return data
  const sessionId = typeof data?.session === 'object' ? (data?.session as any)?.id : data?.session
  if (!sessionId) return data

  const session = await (req.payload as any).findByID({ collection: 'class-sessions', id: sessionId, depth: 1, overrideAccess: true, req })
  const classDoc = session?.class as { teachers?: unknown[]; term?: unknown } | undefined

  if (user.role === 'teacher') {
    const teacherIds = (classDoc?.teachers ?? []).map(idOf)
    if (!teacherIds.includes(user.id)) throw new Forbidden(req.t)
  } else {
    const termId = idOf(classDoc?.term)
    const managed = (user.managedPrograms ?? []).map(idOf)
    if (!managed.map(String).includes(String(termId))) throw new Forbidden(req.t)
  }
  return data
}

/** Back-compat alias (AttendanceRecords imports this name). */
export const assertTeacherOwnsSession = assertSessionScope
```

- [ ] **Step 2: Class/enrollment program guard**

Create `src/hooks/assertProgramScope.ts`:

```ts
import type { CollectionBeforeValidateHook } from 'payload'
import { Forbidden } from 'payload'

/* eslint-disable @typescript-eslint/no-explicit-any */
const idOf = (v: unknown) => (typeof v === 'object' && v !== null && 'id' in v ? (v as { id: unknown }).id : v)

/**
 * For a school_admin creating/updating a class, require `data.term` ∈ managedPrograms.
 * teacher/admin/platformOwner unaffected (their access already gates them).
 */
export const assertClassProgramScope: CollectionBeforeValidateHook = ({ data, req }) => {
  const user = req.user as { role?: string; managedPrograms?: unknown[] } | null | undefined
  if (user?.role !== 'school_admin') return data
  if (data?.term == null) return data
  const managed = (user.managedPrograms ?? []).map(idOf).map(String)
  if (!managed.includes(String(idOf(data.term)))) throw new Forbidden(req.t)
  return data
}

/**
 * For a school_admin creating/updating an enrollment, resolve the class's term and
 * require it ∈ managedPrograms.
 */
export const assertEnrollmentProgramScope: CollectionBeforeValidateHook = async ({ data, req }) => {
  const user = req.user as { role?: string; managedPrograms?: unknown[] } | null | undefined
  if (user?.role !== 'school_admin') return data
  const classId = idOf(data?.class)
  if (classId == null) return data
  const klass = await (req.payload as any).findByID({ collection: 'school-classes', id: classId, depth: 0, overrideAccess: true, req })
  const managed = (user.managedPrograms ?? []).map(idOf).map(String)
  if (!managed.includes(String(idOf(klass?.term)))) throw new Forbidden(req.t)
  return data
}
```

- [ ] **Step 3: Write tests**

Create `tests/hooks/programScope.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { assertClassProgramScope } from '@/hooks/assertProgramScope'
import { assertSessionScope } from '@/hooks/assertTeacherOwnsSession'

const t = (() => {}) as any

describe('assertClassProgramScope', () => {
  it('allows a school_admin to create a class in a managed program', async () => {
    const data = { term: 10 }
    await expect(Promise.resolve(assertClassProgramScope({ data, req: { user: { role: 'school_admin', managedPrograms: [10] }, t } } as any))).resolves.toBe(data)
  })
  it('blocks a class in an unmanaged program', () => {
    expect(() => assertClassProgramScope({ data: { term: 99 }, req: { user: { role: 'school_admin', managedPrograms: [10] }, t } } as any)).toThrow()
  })
  it('ignores non-school_admin', () => {
    const data = { term: 99 }
    expect(assertClassProgramScope({ data, req: { user: { role: 'admin' }, t } } as any)).toBe(data)
  })
})

describe('assertSessionScope (school_admin)', () => {
  const findByID = (term: any) => async () => ({ class: { term, teachers: [] } })
  it('allows when the session’s program is managed', async () => {
    const req = { user: { role: 'school_admin', managedPrograms: [10] }, t, payload: { findByID: findByID(10) } } as any
    await expect(assertSessionScope({ data: { session: 5 }, req } as any)).resolves.toEqual({ session: 5 })
  })
  it('blocks when the session’s program is not managed', async () => {
    const req = { user: { role: 'school_admin', managedPrograms: [10] }, t, payload: { findByID: findByID(99) } } as any
    await expect(assertSessionScope({ data: { session: 5 }, req } as any)).rejects.toThrow()
  })
})
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run tests/hooks/programScope.test.ts` → PASS. `npm test` → all pass. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/assertTeacherOwnsSession.ts src/hooks/assertProgramScope.ts tests/hooks/programScope.test.ts
git commit -m "feat(access): program-scope guards for school_admin (sessions, classes, enrollments)"
```

---

## Task 4: Rewire the six collections + update their access tests

**Files:**
- Modify: `src/collections/Terms.ts`, `SchoolClasses.ts`, `Students.ts`, `Enrollments.ts`, `ClassSessions.ts`, `AttendanceRecords.ts`
- Modify: `tests/collections/{terms,schoolClasses,students,enrollments,classSessions,attendanceRecords}.access.test.ts`

Each collection's access is rewired to the role composition + the right resolvers + create gate + guard. Read each file first; keep the existing `denyKioskManager` wrap and the existing teacher resolver names.

- [ ] **Step 1: Terms**

In `src/collections/Terms.ts`, import `readByRole, schoolAdminTermsRead, adminOnlyCreate, schoolAdminTermsRead as _` (just `readByRole, schoolAdminTermsRead, adminOnlyCreate, writeByRole`). Set:
```ts
  access: {
    read: denyKioskManager(readByRole({ schoolAdmin: schoolAdminTermsRead })),
    create: denyKioskManager(adminOnlyCreate),
    update: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminTermsRead })),
    delete: denyKioskManager(adminOnlyCreate),
  },
```
(Teachers can read terms tenant-wide today via `termRead`; keep that — pass a teacher resolver that returns the tenant read. Simplest: keep the existing `termRead` for `read` but wrap school_admin: use `readByRole({ teacher: async (req) => { const t = tenantOf(req.user); return t ? { tenant: { equals: t } } : false }, schoolAdmin: schoolAdminTermsRead })`.) Delete = `adminOnlyCreate` (admin/platformOwner only).

- [ ] **Step 2: SchoolClasses**

```ts
  access: {
    read: denyKioskManager(readByRole({ teacher: ..teacherClassesResolve.., schoolAdmin: schoolAdminClassesRead })),
    create: denyKioskManager(schoolAdminCreate),
    update: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminClassesRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminClassesRead })),
  },
  hooks: { ...existing..., beforeValidate: [assertClassProgramScope] },
```
The existing teacher class resolver is the inner of `teacherClassesRead`. To reuse it cleanly, define a local `teacherClassesResolve = async (req) => ({ id: { in: await teacherClassIds(req) } })` — but `teacherClassIds` isn't exported. Simplest: export the per-collection teacher resolvers from schoolAccess as plain `Resolve`s OR keep using the existing `teacherClassesRead` for read and only swap create/update/delete. **Recommended minimal approach:** keep `read: denyKioskManager(teacherClassesRead)` (it already handles teacher; but it falls through to `schoolTenantRead` for school_admin = tenant-wide — WRONG). So read MUST go through `readByRole`. Therefore export the teacher resolvers too.

To support this, in Task 2 ALSO export the teacher resolvers as `Resolve`s. Add to `schoolAccess.ts` (Task 2 Step 3) these exports built on the existing `teacherClassIds`:
```ts
export const teacherClassesResolve: Resolve = async (req) => ({ id: { in: await teacherClassIds(req) } })
export const teacherSessionsResolve: Resolve = async (req) => ({ class: { in: await teacherClassIds(req) } })
export const teacherEnrollmentsResolve: Resolve = async (req) => ({ class: { in: await teacherClassIds(req) } })
export const teacherStudentsResolve: Resolve = async (req) => { /* same body as teacherStudentsRead's inner */ }
export const teacherAttendanceResolve: Resolve = async (req) => { /* same body as teacherAttendanceRead's inner */ }
```
(Reuse `teacherClassIds`; for students/attendance reuse the same queries the existing `teacherStudentsRead`/`teacherAttendanceRead` perform.)

Then SchoolClasses:
```ts
    read: denyKioskManager(readByRole({ teacher: teacherClassesResolve, schoolAdmin: schoolAdminClassesRead })),
    create: denyKioskManager(schoolAdminCreate),
    update: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminClassesRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminClassesRead })),
```
and add `beforeValidate: [assertClassProgramScope]` to its hooks (alongside `setTenantFromUser`; afterChange `generateClassSessions` stays).

- [ ] **Step 3: Enrollments**

```ts
    read: denyKioskManager(readByRole({ teacher: teacherEnrollmentsResolve, schoolAdmin: schoolAdminEnrollmentsRead })),
    create: denyKioskManager(schoolAdminCreate),
    update: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminEnrollmentsRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminEnrollmentsRead })),
```
Add `beforeValidate: [assertEnrollmentProgramScope]` to hooks (with `setTenantFromUser`).

- [ ] **Step 4: ClassSessions**

```ts
    read: denyKioskManager(readByRole({ teacher: teacherSessionsResolve, schoolAdmin: schoolAdminSessionsRead })),
    create: denyKioskManager(schoolAdminCreate),
    update: denyKioskManager(writeByRole({ teacher: teacherSessionsResolve, schoolAdmin: schoolAdminSessionsRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminSessionsRead })),
```
(Teachers may update their classes' sessions — give the teacher resolver to update too, matching today's `sessionUpdate`.)

- [ ] **Step 5: AttendanceRecords**

```ts
    read: denyKioskManager(readByRole({ teacher: teacherAttendanceResolve, schoolAdmin: schoolAdminAttendanceRead })),
    create: denyKioskManager((args) => {
      const role = roleOf(args.req.user)
      if (role === 'teacher') return Boolean(tenantOf(args.req.user))
      return schoolAdminCreate(args)
    }),
    update: denyKioskManager(writeByRole({ teacher: teacherAttendanceResolve, schoolAdmin: schoolAdminAttendanceRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminAttendanceRead })),
  },
  hooks: { beforeValidate: [assertSessionScope], beforeChange: [ ...existing markedBy/markedAt... ] },
```
(`assertSessionScope` already covers teacher AND school_admin. Import `roleOf, tenantOf, schoolAdminCreate, readByRole, writeByRole, teacherAttendanceResolve, schoolAdminAttendanceRead` from `../access/schoolAccess`.)

- [ ] **Step 6: Students**

```ts
    read: denyKioskManager(readByRole({ teacher: teacherStudentsResolve, schoolAdmin: schoolAdminStudentsRead })),
    create: denyKioskManager(schoolAdminCreate),
    update: denyKioskManager(writeByRole({ teacher: teacherStudentsResolve, schoolAdmin: schoolAdminStudentsRead })),
    delete: denyKioskManager(writeByRole({ schoolAdmin: schoolAdminStudentsRead })),
```
(No program guard on student create — visibility is via the read resolver; the wizard tags `registeredProgram`.)

- [ ] **Step 7: Update collection access tests**

Each `tests/collections/*.access.test.ts` currently asserts school_admin gets tenant-wide (`{ tenant: { equals } }`). Update those expectations: a school_admin now resolves to the program-scoped `where`. For each, add/adjust cases using a mock req with `managedPrograms` and a mocked `payload.find` (mirror `tests/access/schoolAdminScoped.test.ts`). Concretely, for each collection assert: school_admin read → its program-scoped `where`; admin read → `{ tenant: { equals } }`; staff read → `{ tenant: { equals } }`; staff update → false; school_admin with no managed programs → empty `in`. Remove now-wrong `school_admin === tenant` assertions.

- [ ] **Step 8: Run suite + typecheck + commit**

Run `npx tsc --noEmit` (clean) and `npm test` (all pass — fix any stale school_admin assertions). Then:
```bash
git add src/collections/ tests/collections/
git commit -m "feat(access): scope the six school collections to managed programs for school_admin"
```

---

## Task 5: UI — hide program creation from school_admin

**Files:**
- Modify: `src/admin/school/ProgramPicker.tsx` (hide "+ New program" for non-admins)
- Modify: `src/app/(payload)/admin/sunday-school/setup/page.tsx` (block create-mode for school_admin)

- [ ] **Step 1: Picker hides "+ New program" for non-admins**

In `ProgramPicker.tsx`, fetch the current user's role and only render the `+ New program…` option for admin/platformOwner. Add:
```ts
  const [canCreate, setCanCreate] = useState(false)
  useEffect(() => {
    api('/users/me').then((r) => {
      const role = r?.user?.role
      setCanCreate(role === 'admin' || role === 'platformOwner')
    }).catch(() => {})
  }, [])
```
and render the `<option value="new">+ New program…</option>` only when `canCreate`.

- [ ] **Step 2: Setup route blocks school_admin create-mode**

In `setup/page.tsx`, after resolving `role`, if `role === 'school_admin'` and `sp.program === 'new'`, redirect to the dashboard (they can't create programs):
```ts
  if (role === 'school_admin' && sp.program === 'new') redirect('/admin/sunday-school')
```
Also compute `createMode` so it's never true for school_admin: `const createMode = (sp.program === 'new' || programsRes.docs.length === 0) && role !== 'school_admin'`.

- [ ] **Step 3: Typecheck + build + commit**

Run `npx tsc --noEmit` (clean), `npm test`, `npm run build` (exit 0). Then:
```bash
git add src/admin/school/ProgramPicker.tsx "src/app/(payload)/admin/sunday-school/setup/page.tsx"
git commit -m "feat(access): hide program creation from school_admin"
```

---

## Task 6: Full verification

- [ ] **Step 1: tsc + suite + build**

Run `npx tsc --noEmit` → 0 errors. `npm test` → all pass. `npm run build` → exit 0.

- [ ] **Step 2: Manual verification (after the user applies the migration)**

`npm run dev`. As an admin: open a school_admin user, set **Managed programs** to one program. Log in as that school_admin: the program picker shows only that program; the dashboard/classes/students/attendance show only its data; "+ New program" is absent and `/setup?program=new` redirects; creating a class succeeds (its term is the managed program), and a REST attempt to create a class with another program's term is rejected; another program's classes/students are not visible via the API. As an admin: still sees everything. As a teacher: still only their classes.

- [ ] **Step 3: Commit (only if anything changed)**

If regen produced changes, commit; else skip.

---

## Self-Review

**Spec coverage:**
- `managedPrograms` on Users + migration → Task 1. ✔
- Program-scoped resolvers (terms/classes/sessions/enrollments/students/attendance) → Task 2. ✔
- `readByRole`/`writeByRole` composition; school_admin out of the tenant-wide path → Tasks 2 & 4. ✔
- Create gates (`adminOnlyCreate` for terms; `schoolAdminCreate` elsewhere) → Tasks 2 & 4. ✔
- Guards (session scope generalized; class/enrollment program scope) → Task 3 & wired in Task 4. ✔
- UI: hide "New program" + block create-mode for school_admin → Task 5. ✔
- admin/teacher/staff unchanged → preserved by the composition (admin/staff fall through to `schoolTenant*`; teacher resolvers unchanged). ✔
- Tests for resolvers, composition, guards, and per-collection access → Tasks 2, 3, 4. ✔

**Placeholder scan:** Task 4 Steps 1–2 reference reusing the teacher resolvers — Task 2 Step 3 is amended to EXPORT `teacherClassesResolve`/`teacherSessionsResolve`/`teacherEnrollmentsResolve`/`teacherStudentsResolve`/`teacherAttendanceResolve` (built on the existing `teacherClassIds` + the same queries the current `teacher*Read` use), so every name Task 4 imports is defined. No TODOs.

**Type consistency:** `Resolve = (req) => Promise<where>` used by every resolver and by `readByRole`/`writeByRole`. `managedProgramIds(user)`, `schoolAdminCreate`/`adminOnlyCreate` (Access), and the guard exports (`assertSessionScope`, `assertClassProgramScope`, `assertEnrollmentProgramScope`) are referenced with matching names in Task 4. `assertTeacherOwnsSession` stays exported as an alias so AttendanceRecords' existing import keeps working until Task 4 switches it to `assertSessionScope`.
