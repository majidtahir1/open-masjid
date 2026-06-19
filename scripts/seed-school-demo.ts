import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'

/**
 * Seed demo Sunday-school data so the management views/dashboard have something
 * to show: 5 classes (each with a teacher), 100 students enrolled across them,
 * and attendance marked on the first several sessions of each class.
 *
 * Seeds into the tenant's currently-active term (the one the dashboard shows);
 * if there is no active term it creates one with recent dates so attendance
 * lands on past sessions.
 *
 * Idempotent guard: refuses to run if a previous seed manifest exists — run
 * `cleanup-school-demo.ts` first. Created ids are written to that manifest so
 * cleanup can remove exactly what this added.
 *
 * Run: node --env-file=.env --import tsx scripts/seed-school-demo.ts
 */

const MANIFEST = path.resolve(import.meta.dirname, '.school-demo-seed.json')

const FIRST = [
  'Aisha', 'Bilal', 'Fatima', 'Omar', 'Zainab', 'Yusuf', 'Maryam', 'Ibrahim', 'Khadija', 'Hamza',
  'Sumaya', 'Idris', 'Layla', 'Hassan', 'Ruqayya', 'Musa', 'Asma', 'Tariq', 'Safiya', 'Bilqis',
  'Adam', 'Noor', 'Saad', 'Iman', 'Zaid', 'Hafsa', 'Anas', 'Salma', 'Rayyan', 'Amina',
]
const LAST = [
  'Khan', 'Ahmed', 'Patel', 'Siddiqui', 'Rahman', 'Hussain', 'Ali', 'Malik', 'Sheikh', 'Iqbal',
  'Farooq', 'Mahmood', 'Yusuf', 'Abbasi', 'Chaudhry', 'Ansari', 'Qureshi', 'Saeed', 'Nadeem', 'Bhatti',
]
const CLASSES = [
  { name: 'Grade 1 · Quran', gradeLevel: 'Grade 1', room: 'Room A' },
  { name: 'Grade 2 · Quran', gradeLevel: 'Grade 2', room: 'Room B' },
  { name: 'Grade 3 · Islamic Studies', gradeLevel: 'Grade 3', room: 'Room C' },
  { name: 'Grade 4 · Arabic', gradeLevel: 'Grade 4', room: 'Room D' },
  { name: 'Grade 5 · Seerah', gradeLevel: 'Grade 5', room: 'Room E' },
]
const TEACHERS = [
  { firstName: 'Ustadh', lastName: 'Yusuf Rahman' },
  { firstName: 'Ustadha', lastName: 'Fatima Ali' },
  { firstName: 'Ustadh', lastName: 'Idris Khan' },
  { firstName: 'Ustadha', lastName: 'Maryam Saeed' },
  { firstName: 'Ustadh', lastName: 'Hamza Malik' },
]

const pick = <T>(arr: T[], i: number) => arr[i % arr.length]
function weightedStatus(): 'present' | 'absent' | 'late' | 'excused' {
  const r = Math.random()
  if (r < 0.8) return 'present'
  if (r < 0.88) return 'late'
  if (r < 0.95) return 'absent'
  return 'excused'
}

async function main() {
  if (existsSync(MANIFEST)) {
    console.error(`✗ A seed manifest already exists at ${MANIFEST}.\n  Run cleanup-school-demo.ts before re-seeding.`)
    process.exit(1)
  }

  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  // 1. Active term (the one the dashboard shows), else create one with recent dates.
  let term = (await p.find({ collection: 'terms', where: { status: { equals: 'active' } }, sort: '-startDate', limit: 1, depth: 0, overrideAccess: true })).docs[0]
  let createdTerm = false
  if (!term) {
    // Most recent tenant so the term has somewhere to live.
    const tenant = (await p.find({ collection: 'tenants', limit: 1, depth: 0, overrideAccess: true })).docs[0]
    if (!tenant) { console.error('✗ No tenant found — create a tenant first.'); process.exit(1) }
    term = await p.create({
      collection: 'terms',
      data: { tenant: tenant.id, name: 'Demo Term 2026', status: 'active', meetingDay: 'sunday', startDate: '2026-04-05', endDate: '2026-08-30' },
      overrideAccess: true,
    })
    createdTerm = true
    console.log(`✓ Created active term "${term.name}"`)
  } else {
    console.log(`✓ Using active term "${term.name}"`)
  }
  const tenantId = typeof term.tenant === 'object' ? term.tenant.id : term.tenant

  const manifest = { tenantId, termId: term.id, createdTerm, teacherIds: [] as any[], classIds: [] as any[], studentIds: [] as any[], enrollmentIds: [] as any[] }

  // 2. Teachers (one per class).
  const teacherIds: (string | number)[] = []
  for (let i = 0; i < TEACHERS.length; i++) {
    const t = TEACHERS[i]
    const email = `seed-teacher-${i + 1}@school.demo`
    const user = await p.create({
      collection: 'users',
      data: { email, password: 'DemoTeacher!' + (i + 1), role: 'teacher', tenant: tenantId, firstName: t.firstName, lastName: t.lastName },
      overrideAccess: true,
    })
    teacherIds.push(user.id)
    manifest.teacherIds.push(user.id)
  }
  console.log(`✓ Created ${teacherIds.length} teachers`)

  // 3. Classes (each create auto-generates the term's weekly sessions).
  const classIds: (string | number)[] = []
  for (let i = 0; i < CLASSES.length; i++) {
    const c = CLASSES[i]
    const klass = await p.create({
      collection: 'school-classes',
      data: { tenant: tenantId, term: term.id, name: c.name, gradeLevel: c.gradeLevel, room: c.room, status: 'active', teachers: [teacherIds[i]] },
      overrideAccess: true,
    })
    classIds.push(klass.id)
    manifest.classIds.push(klass.id)
  }
  console.log(`✓ Created ${classIds.length} classes (sessions auto-generated)`)

  // 4. Students (100), 5. enrolled round-robin across the 5 classes.
  let studentN = 0
  for (let i = 0; i < 100; i++) {
    const first = pick(FIRST, i)
    const last = pick(LAST, Math.floor(i / FIRST.length) + i)
    const student = await p.create({
      collection: 'students',
      data: {
        tenant: tenantId, firstName: first, lastName: last, status: 'active',
        age: 5 + (i % 11),
        guardians: [{ name: `${last} family`, phone: `555-01${String(i).padStart(2, '0')}`, isPrimary: true }],
      },
      overrideAccess: true,
    })
    manifest.studentIds.push(student.id)
    const classId = classIds[i % classIds.length]
    const enr = await p.create({
      collection: 'enrollments',
      data: { tenant: tenantId, student: student.id, class: classId, status: 'active' },
      overrideAccess: true,
    })
    manifest.enrollmentIds.push(enr.id)
    studentN++
  }
  console.log(`✓ Created ${studentN} students with enrollments`)

  // 6. Attendance on the first up-to-8 sessions of each class for its roster.
  let records = 0
  for (const classId of classIds) {
    const sessions = (await p.find({ collection: 'class-sessions', where: { class: { equals: classId } }, sort: 'date', limit: 8, depth: 0, overrideAccess: true })).docs
    const roster = (await p.find({ collection: 'enrollments', where: { class: { equals: classId }, status: { equals: 'active' } }, limit: 1000, depth: 0, overrideAccess: true })).docs
    for (const session of sessions) {
      for (const e of roster) {
        const studentId = typeof e.student === 'object' ? e.student.id : e.student
        try {
          await p.create({
            collection: 'attendance-records',
            data: { tenant: tenantId, session: session.id, student: studentId, status: weightedStatus() },
            overrideAccess: true,
          })
          records++
        } catch {
          /* unique (tenant, session, student) — ignore */
        }
      }
    }
  }
  console.log(`✓ Marked ${records} attendance records`)

  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
  console.log(`\n✓ Done. Manifest written to ${MANIFEST}`)
  console.log('  Visit /admin/programs to see the dashboard.')
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
