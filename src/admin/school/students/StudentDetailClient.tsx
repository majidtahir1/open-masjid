'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { api } from '../api'
import SchoolTabs from '../SchoolTabs'
import '../sunday-school.css'

interface Guardian {
  name: string
  relationship: string
  phone: string
  email: string
  isPrimary: boolean
}

const fmtClock = (iso: string | null): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
const fmtDay = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const StudentDetailClient: React.FC<{ studentId: string }> = ({ studentId }) => {
  const router = useRouter()

  const [student, setStudent] = useState<any>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [age, setAge] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [allergiesNotes, setAllergiesNotes] = useState('')
  const [emergencyContact, setEmergencyContact] = useState('')
  const [guardians, setGuardians] = useState<Guardian[]>([])
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [attendanceHistory, setAttendanceHistory] = useState<{ date: string; status: string }[]>([])
  const [checkinLog, setCheckinLog] = useState<{ date: string; inAt: string | null; outAt: string | null; source: string | null }[]>([])
  const [attendanceSummary, setAttendanceSummary] = useState<{ total: number; present: number; rate: number }>({ total: 0, present: 0, rate: 0 })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const doc = await api(`/students/${studentId}?depth=0`)
    setStudent(doc)
    setFirstName(doc.firstName ?? '')
    setLastName(doc.lastName ?? '')
    setAge(doc.age != null ? String(doc.age) : '')
    setGradeLevel(doc.gradeLevel ?? '')
    setAllergiesNotes(doc.allergiesNotes ?? '')
    setEmergencyContact(doc.emergencyContact ?? '')
    setGuardians(
      Array.isArray(doc.guardians)
        ? doc.guardians.map((g: any) => ({
            name: g.name ?? '',
            relationship: g.relationship ?? '',
            phone: g.phone ?? '',
            email: g.email ?? '',
            isPrimary: g.isPrimary ?? false,
          }))
        : [],
    )

    const enrRes = await api(
      `/enrollments?where[student][equals]=${studentId}&where[status][equals]=active&limit=100&depth=1`,
    )
    setEnrollments(enrRes.docs ?? [])

    const attRes = await api(
      `/attendance-records?where[student][equals]=${studentId}&limit=5000&depth=1`,
    )
    const records: any[] = attRes.docs ?? []
    const total = records.length
    const present = records.filter((r: any) => r.status === 'present').length
    const rate = total > 0 ? Math.round((present / total) * 100) : 0
    setAttendanceSummary({ total, present, rate })

    const sorted = [...records].sort((a, b) => {
      const dateA = a.session?.date ?? a.date ?? ''
      const dateB = b.session?.date ?? b.date ?? ''
      return String(dateB).localeCompare(String(dateA))
    })
    setAttendanceHistory(
      sorted.map((r: any) => ({
        date: String(r.session?.date ?? r.date ?? '').slice(0, 10),
        status: r.status ?? '',
      })),
    )

    // Check-in / check-out audit log: sessions where the student was checked in
    // or out (via the parent kiosk or staff), newest first.
    setCheckinLog(
      sorted
        .filter((r: any) => r.checkInAt || r.checkOutAt)
        .map((r: any) => ({
          date: String(r.session?.date ?? r.date ?? '').slice(0, 10),
          inAt: r.checkInAt ?? null,
          outAt: r.checkOutAt ?? null,
          source: r.checkInBy ?? null,
        })),
    )
  }, [studentId])

  useEffect(() => {
    load().catch(() => setError('Could not load student.'))
  }, [load])

  const save = async () => {
    setMsg('')
    setError('')
    const data: any = {
      firstName: firstName || null,
      lastName: lastName || null,
      age: age ? Number(age) : null,
      gradeLevel: gradeLevel || null,
      allergiesNotes: allergiesNotes || null,
      emergencyContact: emergencyContact || null,
      guardians: guardians.map((g) => ({
        name: g.name || null,
        relationship: g.relationship || null,
        phone: g.phone || null,
        email: g.email || null,
        isPrimary: g.isPrimary,
      })),
    }
    try {
      await api(`/students/${studentId}`, { method: 'PATCH', body: JSON.stringify(data) })
      setMsg('Saved.')
      await load()
    } catch (e: any) {
      setError(e.message || 'Save failed.')
    }
  }

  const canDelete = attendanceSummary.total === 0 && enrollments.length === 0

  const deleteStudent = async () => {
    if (!canDelete) return
    if (!confirm('Delete this student? This cannot be undone.')) return
    try {
      await api(`/students/${studentId}`, { method: 'DELETE' })
      router.push('/admin/sunday-school/students')
    } catch (e: any) {
      setError(e.message || 'Delete failed.')
    }
  }

  const addGuardian = () => {
    setGuardians((prev) => [
      ...prev,
      { name: '', relationship: '', phone: '', email: '', isPrimary: false },
    ])
  }

  const updateGuardian = (idx: number, field: keyof Guardian, value: string | boolean) => {
    setGuardians((prev) => prev.map((g, i) => (i === idx ? { ...g, [field]: value } : g)))
  }

  const withdraw = async (enrollmentId: string | number) => {
    try {
      await api(`/enrollments/${enrollmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'withdrawn' }),
      })
      await load()
    } catch (e: any) {
      setError(e.message || 'Withdraw failed.')
    }
  }

  if (!student)
    return (
      <div className="ss-root">
        <SchoolTabs />
        <p className="ss-emptyline">{error || 'Loading…'}</p>
      </div>
    )

  return (
    <div className="ss-root">
      <SchoolTabs />

      <Link
        className="ss-btn ss-btn--ghost ss-btn--small"
        href="/admin/sunday-school/students"
        style={{ marginBottom: 12 }}
      >
        <ArrowLeft size={15} /> All students
      </Link>

      <h1 className="ss-display" style={{ fontSize: 26, marginBottom: 18 }}>
        {firstName} {lastName}
      </h1>

      {/* Details panel */}
      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Details</p>
        <div className="ss-grid">
          <label className="ss-field">
            <span>First name</span>
            <input
              className="ss-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label className="ss-field">
            <span>Last name</span>
            <input
              className="ss-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
          <label className="ss-field">
            <span>Age</span>
            <input
              className="ss-input"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </label>
          <label className="ss-field">
            <span>Grade level</span>
            <input
              className="ss-input"
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
            />
          </label>
          <label className="ss-field" style={{ gridColumn: '1 / -1' }}>
            <span>Allergies / notes</span>
            <textarea
              className="ss-input"
              value={allergiesNotes}
              onChange={(e) => setAllergiesNotes(e.target.value)}
              rows={3}
            />
          </label>
          <label className="ss-field" style={{ gridColumn: '1 / -1' }}>
            <span>Emergency contact</span>
            <input
              className="ss-input"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
            />
          </label>
        </div>
        <div className="ss-foot">
          <button className="ss-btn" onClick={save}>
            <Save size={16} /> Save
          </button>
          <button
            className="ss-btn ss-btn--ghost"
            onClick={deleteStudent}
            disabled={!canDelete}
            title={canDelete ? 'Delete student' : 'Has history — keep the record'}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
        {msg && <p className="ss-note">{msg}</p>}
        {error && <p className="ss-error">{error}</p>}
      </div>

      {/* Guardians panel */}
      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Guardians</p>
        {guardians.map((g, idx) => (
          <div key={idx} className="ss-row" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <input
              className="ss-input"
              placeholder="Name"
              value={g.name}
              onChange={(e) => updateGuardian(idx, 'name', e.target.value)}
              style={{ minWidth: 120, flex: '1 1 120px' }}
            />
            <input
              className="ss-input"
              placeholder="Relationship"
              value={g.relationship}
              onChange={(e) => updateGuardian(idx, 'relationship', e.target.value)}
              style={{ minWidth: 100, flex: '1 1 100px' }}
            />
            <input
              className="ss-input"
              placeholder="Phone"
              value={g.phone}
              onChange={(e) => updateGuardian(idx, 'phone', e.target.value)}
              style={{ minWidth: 120, flex: '1 1 120px' }}
            />
            <input
              className="ss-input"
              placeholder="Email"
              value={g.email}
              onChange={(e) => updateGuardian(idx, 'email', e.target.value)}
              style={{ minWidth: 150, flex: '1 1 150px' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={g.isPrimary}
                onChange={(e) => updateGuardian(idx, 'isPrimary', e.target.checked)}
              />
              Primary
            </label>
          </div>
        ))}
        <button
          className="ss-btn ss-btn--ghost ss-btn--small"
          onClick={addGuardian}
          style={{ marginTop: 8 }}
        >
          + Add guardian
        </button>
      </div>

      {/* Enrollments panel */}
      <div className="ss-card ss-panel" style={{ marginBottom: 16 }}>
        <p className="ss-eyebrow">Enrollments</p>
        {enrollments.length === 0 ? (
          <p className="ss-emptyline">Not enrolled in any class.</p>
        ) : (
          enrollments.map((e: any) => (
            <div key={e.id} className="ss-row">
              <span className="ss-row__name">
                {e.class?.name ?? `Class ${e.class}`}
              </span>
              <button
                className="ss-btn ss-btn--ghost ss-btn--small"
                onClick={() => withdraw(e.id)}
              >
                Withdraw
              </button>
            </div>
          ))
        )}
      </div>

      {/* Attendance history panel */}
      <div className="ss-card ss-panel">
        <p className="ss-eyebrow">Attendance history</p>
        {attendanceSummary.total === 0 ? (
          <p className="ss-emptyline">No attendance recorded yet.</p>
        ) : (
          <>
            <p style={{ marginBottom: 10, fontSize: 14 }}>
              <span className="ss-pill">{attendanceSummary.rate}%</span>{' '}
              present — {attendanceSummary.present}/{attendanceSummary.total} marked
            </p>
            {attendanceHistory.map((rec, idx) => (
              <div key={idx} className="ss-row">
                <span className="ss-row__name">{rec.date}</span>
                <span className={`ss-pill${rec.status === 'absent' ? ' ss-pill--muted' : ''}`}>
                  {rec.status}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Check-in / check-out audit log */}
      <div className="ss-card ss-panel" style={{ marginTop: 16 }}>
        <p className="ss-eyebrow">Check-in / check-out log</p>
        {checkinLog.length === 0 ? (
          <p className="ss-emptyline">No check-ins recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="ss-row" style={{ fontSize: 12, color: 'var(--theme-elevation-500)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <span style={{ flex: 1 }}>Date</span>
              <span style={{ width: 96, textAlign: 'right' }}>In</span>
              <span style={{ width: 96, textAlign: 'right' }}>Out</span>
              <span style={{ width: 72, textAlign: 'right' }}>Source</span>
            </div>
            {checkinLog.map((rec, idx) => (
              <div key={idx} className="ss-row">
                <span className="ss-row__name" style={{ flex: 1 }}>{fmtDay(rec.date)}</span>
                <span style={{ width: 96, textAlign: 'right', color: rec.inAt ? 'var(--ss-teal-500, #2e8b57)' : 'var(--theme-elevation-400)' }}>{fmtClock(rec.inAt)}</span>
                <span style={{ width: 96, textAlign: 'right' }}>{fmtClock(rec.outAt)}</span>
                <span style={{ width: 72, textAlign: 'right', fontSize: 12, color: 'var(--theme-elevation-500)' }}>{rec.source ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default StudentDetailClient
