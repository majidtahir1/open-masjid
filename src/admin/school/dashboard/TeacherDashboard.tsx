'use client'
import React from 'react'
import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import '../sunday-school.css'

const TeacherDashboard: React.FC<{ termName: string | null; classes: { id: string | number; name: string }[] }> = ({ termName, classes }) => (
  <div className="ss-root">
    <p className="ss-eyebrow">Sunday school{termName ? ` · ${termName}` : ''}</p>
    <h1 className="ss-display" style={{ fontSize: 28, marginBottom: 18 }}>Your classes</h1>
    {classes.length === 0 && <p className="ss-emptyline">You have no classes assigned yet.</p>}
    <div className="ss-card" style={{ padding: '8px 14px' }}>
      {classes.map((c) => (
        <div key={c.id} className="ss-row">
          <span className="ss-row__name">{c.name}</span>
          <Link className="ss-btn ss-btn--ghost ss-btn--small" href="/admin/take-attendance"><ClipboardCheck size={15} /> Take attendance</Link>
        </div>
      ))}
    </div>
  </div>
)

export default TeacherDashboard
