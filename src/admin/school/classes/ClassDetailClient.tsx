'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Archive, ArchiveRestore, Trash2, Ban, RotateCcw } from 'lucide-react'
import { api } from '../api'
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

  const load = useCallback(async () => {
    const c = await api(`/school-classes/${classId}?depth=0`)
    setKlass(c)
    setName(c.name ?? '')
    setGrade(c.gradeLevel ?? '')
    setRoom(c.room ?? '')
    setCap(c.capacity != null ? String(c.capacity) : '')
    const ses = (await api(`/class-sessions?where[class][equals]=${classId}&sort=date&limit=1000&depth=0`)).docs
    setSessions(ses)
    const enr = await api(`/enrollments?where[class][equals]=${classId}&limit=0&depth=0`)
    const sessIds = ses.map((s: any) => s.id)
    const att = sessIds.length
      ? await api(`/attendance-records?where[session][in]=${sessIds.join(',')}&limit=0&depth=0`)
      : { totalDocs: 0 }
    setCounts({ enroll: enr.totalDocs ?? 0, att: att.totalDocs ?? 0 })
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
    router.push('/admin/sunday-school/classes')
  }

  const setSessionStatus = async (id: string | number, status: string) => {
    await api(`/class-sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    await load()
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
        href="/admin/sunday-school/classes"
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
