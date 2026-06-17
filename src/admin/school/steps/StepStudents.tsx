'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Check, UserPlus } from 'lucide-react'
import { api } from '../api'

const StepStudents: React.FC<{ onBack: () => void; onFinish: () => void; onChanged: () => void }> = ({ onBack, onFinish, onChanged }) => {
  const [classes, setClasses] = useState<any[]>([])
  const [unplaced, setUnplaced] = useState<any[]>([])
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [age, setAge] = useState('')
  const [guardian, setGuardian] = useState('')
  const [newClass, setNewClass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const tr = await api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0')
    const term = tr.docs[0]
    if (!term) return
    const cl = (await api(`/school-classes?where[term][equals]=${term.id}&limit=1000&depth=0`)).docs
    setClasses(cl)
    const classIds = cl.map((c: any) => c.id)
    const enr = classIds.length
      ? (await api(`/enrollments?where[class][in]=${classIds.join(',')}&where[status][equals]=active&limit=5000&depth=0`)).docs
      : []
    const placed = new Set(enr.map((e: any) => String(typeof e.student === 'object' ? e.student.id : e.student)))
    const students = (await api('/students?where[status][equals]=active&limit=5000&depth=0')).docs
    setUnplaced(students.filter((s: any) => !placed.has(String(s.id))))
  }, [])

  useEffect(() => { reload().catch(() => {}) }, [reload])

  const place = async (studentId: string | number, classId: string) => {
    if (!classId) return
    setError('')
    try {
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: studentId, class: classId, status: 'active' }) })
      await reload(); onChanged()
    } catch {
      setError('Couldn’t place that student — they may already be enrolled in this class.')
    }
  }

  const addNew = async () => {
    if (!newClass) return
    setBusy(true); setError('')
    try {
      const data: any = { firstName: first, lastName: last, status: 'active' }
      if (age) data.age = Number(age)
      if (guardian) data.guardians = [{ name: guardian, isPrimary: true }]
      const student = await api('/students', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: student.id, class: newClass, status: 'active' }) })
      setFirst(''); setLast(''); setAge(''); setGuardian('')
      await reload(); onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ss-card">
      <p className="ss-eyebrow">Step 4</p>
      <h2 className="ss-card__title">Enroll students</h2>
      <p className="ss-card__hint">
        Place students who registered online, or add new ones here. Either way, pick the class they join.
      </p>

      <div className="ss-cols2">
        <div>
          <p className="ss-eyebrow" style={{ color: 'var(--theme-elevation-500)' }}>Registered · awaiting a class</p>
          {unplaced.length === 0 && <p className="ss-emptyline">Everyone&apos;s placed. Nice.</p>}
          {unplaced.map((s) => (
            <div key={s.id} className="ss-row">
              <span className="ss-row__name">
                {s.fullName ?? `${s.firstName} ${s.lastName}`}{s.age ? ` · age ${s.age}` : ''}
              </span>
              <select className="ss-select" style={{ maxWidth: 160 }} defaultValue="" onChange={(e) => place(s.id, e.target.value)}>
                <option value="">Place in…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div>
          <p className="ss-eyebrow" style={{ color: 'var(--theme-elevation-500)' }}>Add a new student</p>
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
      </div>

      {error && <p className="ss-error">{error}</p>}

      <div className="ss-foot">
        <button className="ss-btn ss-btn--ghost" onClick={onBack}><ArrowLeft size={17} /> Back</button>
        <button className="ss-btn" onClick={onFinish}><Check size={17} /> Finish</button>
      </div>
    </div>
  )
}

export default StepStudents
