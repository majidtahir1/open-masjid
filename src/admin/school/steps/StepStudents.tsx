'use client'
import React, { useEffect, useState, useCallback } from 'react'
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
    await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: studentId, class: classId, status: 'active' }) })
    await reload(); onChanged()
  }

  const addNew = async () => {
    if (!newClass) return
    setBusy(true)
    try {
      const data: any = { firstName: first, lastName: last, status: 'active' }
      if (age) data.age = Number(age)
      if (guardian) data.guardians = [{ name: guardian, isPrimary: true }]
      const student = await api('/students', { method: 'POST', body: JSON.stringify(data) }).then((r) => r.doc)
      await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: student.id, class: newClass, status: 'active' }) })
      setFirst(''); setLast(''); setAge(''); setGuardian('')
      await reload(); onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2>4. Students</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div>
          <h3>Place registered students</h3>
          {unplaced.length === 0 && <p style={{ color: 'var(--theme-elevation-500)' }}>No unplaced students.</p>}
          {unplaced.map((s) => (
            <div key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
              <span style={{ flex: 1 }}>{s.fullName ?? `${s.firstName} ${s.lastName}`}{s.age ? ` (age ${s.age})` : ''}</span>
              <select defaultValue="" onChange={(e) => place(s.id, e.target.value)}>
                <option value="">place in…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div>
          <h3>Add a new student</h3>
          <div style={{ display: 'grid', gap: 8, maxWidth: 320 }}>
            <input placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
            <input placeholder="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            <input placeholder="Guardian name" value={guardian} onChange={(e) => setGuardian(e.target.value)} />
            <select value={newClass} onChange={(e) => setNewClass(e.target.value)}>
              <option value="">Enroll in class…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn btn--style-secondary btn--size-medium" disabled={busy || !first || !last || !newClass} onClick={addNew}>Add & enroll</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
        <button className="btn btn--style-secondary btn--size-medium" onClick={onBack}>← Back</button>
        <button className="btn btn--style-primary btn--size-medium" onClick={onFinish}>Finish →</button>
      </div>
    </div>
  )
}

export default StepStudents
