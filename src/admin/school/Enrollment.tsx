'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { UserPlus, RefreshCw } from 'lucide-react'
import { api, toId } from './api'
import SchoolTabs from './SchoolTabs'
import './sunday-school.css'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Doc = { id: number | string; [k: string]: any }
const idStr = (v: unknown): string => String(typeof v === 'object' && v !== null && 'id' in v ? (v as any).id : v)

interface RosterEntry { enrollmentId: string | number; studentId: string; name: string }

const Enrollment: React.FC<{ programId: string | null }> = ({ programId }) => {
  const [classes, setClasses] = useState<Doc[]>([])
  const [unplaced, setUnplaced] = useState<Doc[]>([])
  const [rosters, setRosters] = useState<Record<string, RosterEntry[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // inline add
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [age, setAge] = useState('')
  const [guardian, setGuardian] = useState('')
  const [newClass, setNewClass] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    if (!programId) { setClasses([]); setUnplaced([]); setRosters({}); return }
    setLoading(true); setError('')
    try {
      const cl: Doc[] = (await api(`/school-classes?where[term][equals]=${programId}&where[status][equals]=active&limit=1000&depth=0`)).docs
      setClasses(cl)
      const classIds = cl.map((c) => c.id)
      const enr: Doc[] = classIds.length
        ? (await api(`/enrollments?where[class][in]=${classIds.join(',')}&where[status][equals]=active&limit=5000&depth=1`)).docs
        : []
      const placed = new Set<string>()
      const byClass: Record<string, RosterEntry[]> = {}
      for (const c of cl) byClass[idStr(c.id)] = []
      for (const e of enr) {
        const sid = idStr(e.student)
        placed.add(sid)
        const cid = idStr(e.class)
        const stu = e.student
        const name = typeof stu === 'object' ? (stu.fullName || `${stu.firstName ?? ''} ${stu.lastName ?? ''}`.trim()) : `Student ${sid}`
        if (byClass[cid]) byClass[cid].push({ enrollmentId: e.id, studentId: sid, name })
      }
      for (const cid of Object.keys(byClass)) byClass[cid].sort((a, b) => a.name.localeCompare(b.name))
      setRosters(byClass)
      const students: Doc[] = (await api(`/students?where[status][equals]=active&where[registeredProgram][equals]=${programId}&limit=5000&depth=0`)).docs
      setUnplaced(students.filter((s) => !placed.has(idStr(s.id))).sort((a, b) =>
        String(a.fullName ?? a.firstName).localeCompare(String(b.fullName ?? b.firstName))))
    } catch (e) {
      setError((e as Error).message || 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }, [programId])

  useEffect(() => { reload() }, [reload])

  const place = async (studentId: string | number, classId: string) => {
    if (!classId) return
    setError('')
    try {
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(studentId), class: toId(classId), status: 'active' }) })
      await reload()
    } catch (e) { setError((e as Error).message || 'Couldn’t place that student.') }
  }

  const withdraw = async (enrollmentId: string | number) => {
    if (!confirm('Withdraw this student from the class?')) return
    setError('')
    try {
      await api(`/enrollments/${toId(enrollmentId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn' }) })
      await reload()
    } catch (e) { setError((e as Error).message || 'Withdraw failed.') }
  }

  // Move = withdraw the current enrollment + create a new active one (history preserved).
  const move = async (enrollmentId: string | number, studentId: string, newClassId: string) => {
    if (!newClassId) return
    setError('')
    try {
      await api(`/enrollments/${toId(enrollmentId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn' }) })
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(studentId), class: toId(newClassId), status: 'active' }) })
      await reload()
    } catch (e) { setError((e as Error).message || 'Move failed.') }
  }

  const addNew = async () => {
    if (!newClass || !first || !last) return
    setBusy(true); setError('')
    try {
      const data: any = { firstName: first, lastName: last, status: 'active', ...(programId ? { registeredProgram: toId(programId) } : {}) }
      if (age) data.age = Number(age)
      if (guardian) data.guardians = [{ name: guardian, isPrimary: true }]
      const student = await api('/students', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(student.id), class: toId(newClass), status: 'active' }) })
      setFirst(''); setLast(''); setAge(''); setGuardian('')
      await reload()
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="ss-root">
      <SchoolTabs />
      <header className="ss-masthead">
        <p className="ss-eyebrow">Enrollment</p>
        <h1 className="ss-masthead__title">Place &amp; manage students</h1>
      </header>

      <div className="ss-actions" style={{ margin: '14px 0 0' }}>
        <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => reload()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <p className="ss-error">{error}</p>}
      {!programId && <p className="ss-emptyline">Pick a program to manage enrollment.</p>}

      {programId && (
        <>
          {/* Needs placement */}
          <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
            <p className="ss-eyebrow">Needs placement</p>
            {unplaced.length === 0 ? (
              <p className="ss-emptyline">{loading ? 'Loading…' : 'Everyone registered is placed. 🎉'}</p>
            ) : (
              unplaced.map((s) => (
                <div key={s.id} className="ss-row">
                  <span className="ss-row__name">
                    {s.fullName ?? `${s.firstName} ${s.lastName}`}
                    {s.gradeLevel ? <span style={{ color: 'var(--theme-elevation-500)' }}> · grade {s.gradeLevel}</span> : null}
                    {s.age ? <span style={{ color: 'var(--theme-elevation-500)' }}> · age {s.age}</span> : null}
                  </span>
                  <select className="ss-select" style={{ maxWidth: 180 }} defaultValue="" onChange={(e) => place(s.id, e.target.value)}>
                    <option value="">Place in…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              ))
            )}
          </div>

          {/* Inline add */}
          <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
            <p className="ss-eyebrow">Add &amp; enroll a new student</p>
            <div className="ss-grid">
              <input className="ss-input" placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
              <input className="ss-input" placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
              <input className="ss-input" placeholder="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
              <input className="ss-input" placeholder="Guardian name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
              <select className="ss-select" value={newClass} onChange={(e) => setNewClass(e.target.value)}>
                <option value="">Enroll in class…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="ss-btn ss-btn--ghost" disabled={busy || !first || !last || !newClass} onClick={addNew}>
                <UserPlus size={16} /> Add &amp; enroll
              </button>
            </div>
          </div>

          {/* Class rosters */}
          <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
            <p className="ss-eyebrow">Class rosters</p>
            {classes.length === 0 && <p className="ss-emptyline">No active classes in this program.</p>}
            {classes.map((c) => {
              const cid = idStr(c.id)
              const roster = rosters[cid] ?? []
              return (
                <div key={c.id} style={{ marginBottom: 18 }}>
                  <p className="ss-eyebrow" style={{ color: 'var(--theme-elevation-500)' }}>{c.name} · {roster.length}</p>
                  {roster.length === 0 ? (
                    <p className="ss-emptyline">No students enrolled.</p>
                  ) : (
                    roster.map((r) => (
                      <div key={r.enrollmentId} className="ss-row">
                        <span className="ss-row__name">{r.name}</span>
                        <span style={{ display: 'inline-flex', gap: 8 }}>
                          <select className="ss-select" style={{ maxWidth: 150 }} defaultValue="" onChange={(e) => move(r.enrollmentId, r.studentId, e.target.value)}>
                            <option value="">Move to…</option>
                            {classes.filter((x) => idStr(x.id) !== cid).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                          </select>
                          <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => withdraw(r.enrollmentId)}>Withdraw</button>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default Enrollment
