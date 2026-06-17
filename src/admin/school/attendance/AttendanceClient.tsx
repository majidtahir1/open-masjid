'use client'

import React, { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api } from '../api'
import SchoolTabs from '../SchoolTabs'
import '../sunday-school.css'
import { buildAttendanceCsv } from '@/lib/attendance-csv'

interface SchoolClass {
  id: string | number
  name: string
}

interface Session {
  id: string | number
  date: string
  status?: string
}

interface Student {
  id: string | number
  firstName?: string
  lastName?: string
  fullName?: string
}

interface Enrollment {
  id: string | number
  student?: Student | string | number
  status?: string
}

interface AttendanceRecord {
  id: string | number
  student: string | number | { id: string | number }
  session: string | number | { id: string | number }
  status: string
}

function idOf(v: unknown): string | number {
  if (v == null) return ''
  if (typeof v === 'object' && 'id' in (v as object)) return (v as { id: string | number }).id
  return v as string | number
}

function studentName(s: Student): string {
  if (s.fullName) return s.fullName
  return [s.firstName, s.lastName].filter(Boolean).join(' ') || String(s.id)
}

function presentRate(studentId: string | number, sessions: Session[], records: AttendanceRecord[]): string {
  const sessionIds = new Set(sessions.map((s) => String(s.id)))
  const relevant = records.filter(
    (r) => String(idOf(r.student)) === String(studentId) && sessionIds.has(String(idOf(r.session))),
  )
  const marked = relevant.length
  const present = relevant.filter((r) => r.status === 'present').length
  if (marked === 0) return '—'
  return `${present}/${marked}`
}

export default function AttendanceClient() {
  const [classes, setClasses] = useState<SchoolClass[]>([])
  const [classId, setClassId] = useState<string>('')
  const [className, setClassName] = useState<string>('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load class list
  useEffect(() => {
    api('/school-classes?where[status][equals]=active&limit=1000&depth=0')
      .then((res) => setClasses(res.docs ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  // Load sessions, students, records when class changes
  useEffect(() => {
    if (!classId) {
      setSessions([])
      setStudents([])
      setRecords([])
      return
    }
    setLoading(true)
    setError(null)

    const chosen = classes.find((c) => String(c.id) === classId)
    setClassName(chosen?.name ?? classId)

    Promise.all([
      api(`/class-sessions?where[class][equals]=${classId}&where[status][not_equals]=cancelled&sort=date&limit=1000&depth=0`),
      api(`/enrollments?where[class][equals]=${classId}&where[status][equals]=active&limit=1000&depth=1`),
    ])
      .then(async ([sessRes, enrollRes]) => {
        const fetchedSessions: Session[] = sessRes.docs ?? []
        setSessions(fetchedSessions)

        const enrollments: Enrollment[] = enrollRes.docs ?? []
        const fetchedStudents: Student[] = enrollments
          .map((e) => e.student)
          .filter((s): s is Student => typeof s === 'object' && s !== null && 'id' in s)
        setStudents(fetchedStudents)

        if (fetchedSessions.length === 0) {
          setRecords([])
          return
        }

        const sessionIds = fetchedSessions.map((s) => s.id).join(',')
        const recRes = await api(`/attendance-records?where[session][in]=${sessionIds}&limit=10000&depth=0`)
        setRecords(recRes.docs ?? [])
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  function handleExportCsv() {
    const csv = buildAttendanceCsv(
      students.map((s) => ({ id: s.id, name: studentName(s) })),
      sessions,
      records.map((r) => ({ student: idOf(r.student), session: idOf(r.session), status: r.status })),
    )
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${className}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Per-session summary: count statuses
  function sessionSummary(sessionId: string | number) {
    const sessionRecords = records.filter((r) => String(idOf(r.session)) === String(sessionId))
    const counts: Record<string, number> = {}
    for (const r of sessionRecords) {
      counts[r.status] = (counts[r.status] ?? 0) + 1
    }
    return counts
  }

  const STATUS_LABELS = ['present', 'absent', 'late', 'excused'] as const

  return (
    <div className="ss-root">
      <SchoolTabs />

      <div style={{ padding: '28px 32px 0' }}>
        <p className="ss-eyebrow">Sunday School</p>
        <h1 className="ss-display">Attendance</h1>
      </div>

      <div style={{ padding: '20px 32px 40px' }}>
        {/* Class picker */}
        <div style={{ marginBottom: 24 }}>
          <select
            className="ss-select"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            aria-label="Choose a class"
          >
            <option value="">Choose a class…</option>
            {classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="ss-error">{error}</p>}

        {!classId && (
          <p className="ss-emptyline">Choose a class to see attendance.</p>
        )}

        {classId && !loading && sessions.length === 0 && (
          <p className="ss-emptyline">No sessions yet.</p>
        )}

        {classId && !loading && students.length === 0 && sessions.length > 0 && (
          <p className="ss-emptyline">No students enrolled.</p>
        )}

        {classId && !loading && sessions.length > 0 && students.length > 0 && (
          <>
            {/* Export button */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="ss-btn" onClick={handleExportCsv} type="button">
                <Download size={15} style={{ marginRight: 6 }} />
                Export CSV
              </button>
            </div>

            {/* By-session view */}
            <div className="ss-card" style={{ marginBottom: 28 }}>
              <h2 className="ss-card__title" style={{ fontSize: 18, marginBottom: 16 }}>
                By Session
              </h2>
              {sessions.map((session) => {
                const counts = sessionSummary(session.id)
                return (
                  <div key={session.id} className="ss-row">
                    <span className="ss-row__name">{String(session.date).slice(0, 10)}</span>
                    {STATUS_LABELS.map((status) =>
                      counts[status] != null ? (
                        <span key={status} className="ss-pill" style={{ marginLeft: 6 }}>
                          {counts[status]} {status}
                        </span>
                      ) : null,
                    )}
                  </div>
                )
              })}
            </div>

            {/* Per-student view */}
            <div className="ss-card">
              <h2 className="ss-card__title" style={{ fontSize: 18, marginBottom: 16 }}>
                By Student
              </h2>
              {students.map((student) => {
                const rate = presentRate(student.id, sessions, records)
                return (
                  <div key={student.id} className="ss-row">
                    <span className="ss-row__name">{studentName(student)}</span>
                    <span className="ss-pill ss-pill--muted">{rate} present</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
