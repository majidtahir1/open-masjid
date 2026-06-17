'use client'
import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { UserPlus, ChevronRight } from 'lucide-react'
import { api } from '../api'
import SchoolTabs from '../SchoolTabs'
import '../sunday-school.css'

interface Student {
  id: string | number
  firstName: string
  lastName: string
  fullName?: string
  age?: number
  grade?: string
  status: string
}

const idOf = (v: unknown): string | number | null =>
  v == null ? null : typeof v === 'object' && v !== null && 'id' in v
    ? (v as { id: string | number }).id
    : (v as string | number)

const StudentsClient: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([])
  const [classMap, setClassMap] = useState<Record<string | number, string>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [age, setAge] = useState('')
  const [guardian, setGuardian] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [studentsRes, enrollmentsRes] = await Promise.all([
        api('/students?where[status][equals]=active&limit=5000&depth=0&sort=lastName'),
        api('/enrollments?where[status][equals]=active&limit=5000&depth=1'),
      ])

      // Build studentId -> class name(s) map
      const map: Record<string | number, string[]> = {}
      for (const enr of enrollmentsRes.docs ?? []) {
        const sid = idOf(enr.student)
        const cls = enr.class
        if (sid == null) continue
        const className =
          typeof cls === 'object' && cls !== null
            ? (cls as { name?: string }).name ?? 'Unknown class'
            : null
        if (!className) continue
        if (!map[sid]) map[sid] = []
        map[sid].push(className)
      }
      const flatMap: Record<string | number, string> = {}
      for (const [sid, names] of Object.entries(map)) {
        flatMap[sid] = names.join(', ')
      }

      setStudents(studentsRes.docs ?? [])
      setClassMap(flatMap)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload().catch(() => setLoading(false))
  }, [reload])

  const add = async () => {
    if (!firstName || !lastName) return
    setBusy(true)
    setError(null)
    try {
      const data: Record<string, unknown> = {
        firstName,
        lastName,
        status: 'active',
      }
      if (age) data.age = Number(age)
      if (guardian) data.guardians = [{ name: guardian, isPrimary: true }]

      await api('/students', { method: 'POST', body: JSON.stringify(data) })
      setFirstName('')
      setLastName('')
      setAge('')
      setGuardian('')
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add student')
    } finally {
      setBusy(false)
    }
  }

  const filtered = students.filter((s) => {
    if (!search) return true
    const name = s.fullName ?? `${s.firstName} ${s.lastName}`
    return name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="ss-root">
      <SchoolTabs />

      <div className="ss-att__bar">
        <div>
          <p className="ss-eyebrow">Sunday School</p>
          <h1 className="ss-display" style={{ fontSize: 26 }}>
            Students
          </h1>
        </div>
        <input
          className="ss-input"
          style={{ maxWidth: 240 }}
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="ss-error">{error}</p>}
      {loading && <p className="ss-emptyline">Loading…</p>}

      {!loading && (
        <>
          <p className="ss-emptyline" style={{ marginBottom: 8 }}>
            {filtered.length} student{filtered.length !== 1 ? 's' : ''}
          </p>

          <div className="ss-card" style={{ padding: '8px 14px', marginBottom: 16 }}>
            {filtered.length === 0 && <p className="ss-emptyline">No students yet.</p>}
            {filtered.map((s) => {
              const name = s.fullName ?? `${s.firstName} ${s.lastName}`
              const className = classMap[s.id] ?? null
              return (
                <Link
                  key={s.id}
                  href={`/admin/sunday-school/students/${s.id}`}
                  className="ss-row"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <span className="ss-row__name">
                    {name}
                    {s.age != null ? ` · age ${s.age}` : ''}
                  </span>
                  {s.grade && (
                    <span className="ss-pill ss-pill--muted">{s.grade}</span>
                  )}
                  <span className="ss-pill">{className ?? 'No class'}</span>
                  <ChevronRight size={16} style={{ color: 'var(--theme-elevation-400)' }} />
                </Link>
              )
            })}
          </div>

          <div className="ss-card ss-panel">
            <p className="ss-eyebrow">Add a student</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                className="ss-input"
                style={{ maxWidth: 160 }}
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="ss-input"
                style={{ maxWidth: 160 }}
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                className="ss-input"
                style={{ maxWidth: 80 }}
                placeholder="Age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              <input
                className="ss-input"
                style={{ maxWidth: 200 }}
                placeholder="Guardian name (optional)"
                value={guardian}
                onChange={(e) => setGuardian(e.target.value)}
              />
              <button
                className="ss-btn"
                disabled={busy || !firstName || !lastName}
                onClick={add}
              >
                <UserPlus size={16} /> Add
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default StudentsClient
