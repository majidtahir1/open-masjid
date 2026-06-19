'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Archive, ArchiveRestore, Trash2, Ban, RotateCcw } from 'lucide-react'
import { api, toId } from '../api'
import { canHardDelete } from '@/lib/school-reports'
import SchoolTabs from '../SchoolTabs'
import '../sunday-school.css'

const ClassDetailClient: React.FC<{ classId: string }> = ({ classId }) => {
  const router = useRouter()
  const [klass, setKlass] = useState<any>(null)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('')
  const [room, setRoom] = useState('')
  const [capacity, setCap] = useState('')
  const [sessions, setSessions] = useState<any[]>([])
  const [counts, setCounts] = useState<{ enroll: number; att: number }>({ enroll: 0, att: 0 })
  const [msg, setMsg] = useState('')
  const [roster, setRoster] = useState<any[]>([]) // active enrollments w/ populated student
  const [allClasses, setAllClasses] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [unplaced, setUnplaced] = useState<any[]>([])

  const load = useCallback(async () => {
    const klassDoc = await api(`/school-classes/${classId}?depth=0`)
    setKlass(klassDoc)
    setName(klassDoc.name ?? '')
    setGrade(klassDoc.gradeLevel ?? '')
    setRoom(klassDoc.room ?? '')
    setCap(klassDoc.capacity != null ? String(klassDoc.capacity) : '')
    const ses = (await api(`/class-sessions?where[class][equals]=${classId}&sort=date&limit=1000&depth=0`)).docs
    setSessions(ses)
    const enr = await api(`/enrollments?where[class][equals]=${classId}&limit=0&depth=0`)
    const sessIds = ses.map((s: any) => s.id)
    const att = sessIds.length
      ? await api(`/attendance-records?where[session][in]=${sessIds.join(',')}&limit=0&depth=0`)
      : { totalDocs: 0 }
    setCounts({ enroll: enr.totalDocs ?? 0, att: att.totalDocs ?? 0 })
    const term = typeof klassDoc.term === 'object' ? klassDoc.term?.id : klassDoc.term
    setRoster((await api(`/enrollments?where[class][equals]=${classId}&where[status][equals]=active&limit=1000&depth=1`)).docs)
    setAllClasses((await api(`/school-classes?where[term][equals]=${term}&where[status][equals]=active&limit=1000&depth=0`)).docs)
    setTeachers((await api('/users?where[role][equals]=teacher&limit=1000&depth=0')).docs)
    const termClassIds = (await api(`/school-classes?where[term][equals]=${term}&limit=1000&depth=0`)).docs.map((tc: any) => tc.id)
    const placedIds = new Set(
      (termClassIds.length
        ? (await api(`/enrollments?where[class][in]=${termClassIds.join(',')}&where[status][equals]=active&limit=5000&depth=0`)).docs
        : []
      ).map((e: any) => String(typeof e.student === 'object' ? e.student.id : e.student)),
    )
    setUnplaced((await api('/students?where[status][equals]=active&limit=5000&depth=0')).docs.filter((s: any) => !placedIds.has(String(s.id))))
  }, [classId])

  useEffect(() => {
    load().catch(() => setMsg('Could not load this class.'))
  }, [load])

  const saveClass = async () => {
    setMsg('')
    const data: any = {
      name,
      gradeLevel: grade || null,
      room: room || null,
      capacity: capacity ? Number(capacity) : null,
    }
    await api(`/school-classes/${classId}`, { method: 'PATCH', body: JSON.stringify(data) })
    setMsg('Saved.')
    await load()
  }

  const setStatus = async (status: 'active' | 'archived') => {
    await api(`/school-classes/${classId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    await load()
  }

  const hardDelete = async () => {
    if (
      !canHardDelete({
        sessionCount: sessions.length,
        attendanceCount: counts.att,
        enrollmentCount: counts.enroll,
      })
    ) {
      setMsg('This class has history — archive it instead of deleting.')
      return
    }
    if (!confirm('Delete this class? This cannot be undone.')) return
    await api(`/school-classes/${classId}`, { method: 'DELETE' })
    router.push('/admin/programs/classes')
  }

  const setSessionStatus = async (id: string | number, status: string) => {
    await api(`/class-sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    await load()
  }

  const enroll = async (studentId: string | number) => {
    await api('/enrollments', { method: 'POST', body: JSON.stringify({ student: toId(studentId), class: toId(classId), status: 'active' }) }); await load()
  }
  const withdraw = async (enrollmentId: string | number) => {
    await api(`/enrollments/${enrollmentId}`, { method: 'PATCH', body: JSON.stringify({ status: 'withdrawn' }) }); await load()
  }
  const move = async (enrollmentId: string | number, toClass: string) => {
    if (!toClass) return
    await api(`/enrollments/${enrollmentId}`, { method: 'PATCH', body: JSON.stringify({ class: toId(toClass) }) }); await load()
  }
  const setTeacher = async (teacherId: string) => {
    await api(`/school-classes/${classId}`, { method: 'PATCH', body: JSON.stringify({ teachers: teacherId ? [toId(teacherId)] : [] }) }); await load()
  }

  if (!klass)
    return (
      <div className="ss-root">
        <SchoolTabs />
        <p className="ss-emptyline">{msg || 'Loading…'}</p>
      </div>
    )

  const archived = klass.status === 'archived'
  const hardOk = canHardDelete({
    sessionCount: sessions.length,
    attendanceCount: counts.att,
    enrollmentCount: counts.enroll,
  })

  return (
    <div className="ss-root">
      <SchoolTabs />
      <Link
        className="ss-btn ss-btn--ghost ss-btn--small"
        href="/admin/programs/classes"
        style={{ marginBottom: 12 }}
      >
        <ArrowLeft size={15} /> All classes
      </Link>
      <h1 className="ss-display" style={{ fontSize: 26, marginBottom: 18 }}>
        {klass.name}
      </h1>

      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Class details</p>
        <div className="ss-grid">
          <label className="ss-field">
            <span>Name</span>
            <input className="ss-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="ss-field">
            <span>Grade level</span>
            <input className="ss-input" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </label>
          <label className="ss-field">
            <span>Room</span>
            <input className="ss-input" value={room} onChange={(e) => setRoom(e.target.value)} />
          </label>
          <label className="ss-field">
            <span>Capacity</span>
            <input
              className="ss-input"
              type="number"
              value={capacity}
              onChange={(e) => setCap(e.target.value)}
            />
          </label>
        </div>
        <div className="ss-foot">
          <button className="ss-btn" onClick={saveClass}>
            <Save size={16} /> Save
          </button>
          {archived ? (
            <button className="ss-btn ss-btn--ghost" onClick={() => setStatus('active')}>
              <ArchiveRestore size={16} /> Restore
            </button>
          ) : (
            <button className="ss-btn ss-btn--ghost" onClick={() => setStatus('archived')}>
              <Archive size={16} /> Archive
            </button>
          )}
          <button
            className="ss-btn ss-btn--ghost"
            onClick={hardDelete}
            disabled={!hardOk}
            title={hardOk ? 'Delete' : 'Has history — archive instead'}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
        {msg && <p className="ss-note">{msg}</p>}
      </div>

      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Teacher</p>
        <select className="ss-select" style={{ maxWidth: 280 }} value={Array.isArray(klass.teachers) && klass.teachers[0] ? String(typeof klass.teachers[0] === 'object' ? klass.teachers[0].id : klass.teachers[0]) : ''} onChange={(e) => setTeacher(e.target.value)}>
          <option value="">No teacher</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.email}</option>)}
        </select>
      </div>

      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Roster · {roster.length}</p>
        {roster.length === 0 && <p className="ss-emptyline">No students enrolled.</p>}
        {roster.map((e) => {
          const s = e.student || {}
          return (
            <div key={e.id} className="ss-row">
              <span className="ss-row__name">{s.fullName ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()}</span>
              <select className="ss-select" style={{ maxWidth: 170 }} defaultValue="" onChange={(ev) => move(e.id, ev.target.value)}>
                <option value="">Move to…</option>
                {allClasses.filter((c) => String(c.id) !== String(classId)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button className="ss-btn ss-btn--ghost ss-btn--small" onClick={() => withdraw(e.id)}>Withdraw</button>
            </div>
          )
        })}
        {unplaced.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="ss-eyebrow" style={{ margin: 0 }}>Enroll a student</span>
            <select className="ss-select" style={{ maxWidth: 240 }} defaultValue="" onChange={(e) => { if (e.target.value) enroll(e.target.value) }}>
              <option value="">Choose…</option>
              {unplaced.map((s) => <option key={s.id} value={s.id}>{s.fullName ?? `${s.firstName} ${s.lastName}`}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="ss-card ss-panel">
        <p className="ss-eyebrow">Sessions · {sessions.length}</p>
        {sessions.length === 0 && <p className="ss-emptyline">No sessions.</p>}
        {sessions.map((s) => (
          <div key={s.id} className="ss-row">
            <span className="ss-row__name">{String(s.date).slice(0, 10)}</span>
            <span className={`ss-pill${s.status === 'cancelled' ? ' ss-pill--muted' : ''}`}>
              {s.status}
            </span>
            <Link className="ss-btn ss-btn--ghost ss-btn--small" href="/admin/take-attendance">
              Attendance
            </Link>
            {s.status === 'cancelled' ? (
              <button
                className="ss-btn ss-btn--ghost ss-btn--small"
                onClick={() => setSessionStatus(s.id, 'scheduled')}
              >
                <RotateCcw size={14} /> Reactivate
              </button>
            ) : (
              <button
                className="ss-btn ss-btn--ghost ss-btn--small"
                onClick={() => setSessionStatus(s.id, 'cancelled')}
              >
                <Ban size={14} /> Cancel
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default ClassDetailClient
