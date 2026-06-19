import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'

/**
 * Remove everything created by seed-school-demo.ts, in dependency order so the
 * class delete-guard (which blocks deleting a class that still has sessions or
 * enrollments) passes: attendance → sessions → enrollments → classes →
 * students → teachers → term (only if the seed created it).
 *
 * Run: node --env-file=.env --import tsx scripts/cleanup-school-demo.ts
 */

const MANIFEST = path.resolve(import.meta.dirname, '.school-demo-seed.json')

async function main() {
  if (!existsSync(MANIFEST)) {
    console.error(`✗ No seed manifest at ${MANIFEST} — nothing to clean up.`)
    process.exit(1)
  }
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const payload = await getPayload({ config })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any

  const classIds: (string | number)[] = m.classIds ?? []

  // 1 & 2: attendance + sessions for the seeded classes.
  let att = 0, ses = 0
  for (const classId of classIds) {
    const sessions = (await p.find({ collection: 'class-sessions', where: { class: { equals: classId } }, limit: 5000, depth: 0, overrideAccess: true })).docs
    for (const s of sessions) {
      const recs = (await p.find({ collection: 'attendance-records', where: { session: { equals: s.id } }, limit: 5000, depth: 0, overrideAccess: true })).docs
      for (const r of recs) { await p.delete({ collection: 'attendance-records', id: r.id, overrideAccess: true }); att++ }
      await p.delete({ collection: 'class-sessions', id: s.id, overrideAccess: true }); ses++
    }
  }
  console.log(`✓ Deleted ${att} attendance records, ${ses} sessions`)

  // 3: enrollments.
  for (const id of m.enrollmentIds ?? []) {
    try { await p.delete({ collection: 'enrollments', id, overrideAccess: true }) } catch { /* already gone */ }
  }
  console.log(`✓ Deleted ${(m.enrollmentIds ?? []).length} enrollments`)

  // 4: classes (now empty → delete-guard passes).
  for (const id of classIds) {
    try { await p.delete({ collection: 'school-classes', id, overrideAccess: true }) } catch (e) { console.warn(`  class ${id}:`, (e as Error).message) }
  }
  console.log(`✓ Deleted ${classIds.length} classes`)

  // 5: students.
  for (const id of m.studentIds ?? []) {
    try { await p.delete({ collection: 'students', id, overrideAccess: true }) } catch { /* already gone */ }
  }
  console.log(`✓ Deleted ${(m.studentIds ?? []).length} students`)

  // 6: teacher users.
  for (const id of m.teacherIds ?? []) {
    try { await p.delete({ collection: 'users', id, overrideAccess: true }) } catch { /* already gone */ }
  }
  console.log(`✓ Deleted ${(m.teacherIds ?? []).length} teachers`)

  // 7: term, only if the seed created it.
  if (m.createdTerm && m.termId) {
    try { await p.delete({ collection: 'terms', id: m.termId, overrideAccess: true }); console.log('✓ Deleted the seeded term') } catch { /* keep */ }
  }

  unlinkSync(MANIFEST)
  console.log(`\n✓ Cleanup complete. Manifest removed.`)
  process.exit(0)
}

main().catch((err) => { console.error(err); process.exit(1) })
