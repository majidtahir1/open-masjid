'use client'
import React from 'react'
import Link from 'next/link'
import type { HubSummary } from '@/lib/school-setup'
import { firstIncompleteStep } from '@/lib/school-setup'

const tile: React.CSSProperties = { border: '1px solid var(--theme-elevation-150)', borderRadius: 8, padding: '12px 16px', minWidth: 140 }

const HubClient: React.FC<{ summary: HubSummary; canSetup: boolean }> = ({ summary, canSetup }) => {
  const resume = firstIncompleteStep(summary)
  return (
    <div style={{ padding: '1.5rem', maxWidth: 880 }}>
      <h1>Sunday School</h1>
      <p style={{ color: 'var(--theme-elevation-600)' }}>
        A <strong>Term</strong> holds <strong>Classes</strong>. Each class meets weekly —{' '}
        <strong>Sessions are created automatically</strong> from the term&apos;s dates. Students enroll into classes.
      </p>

      {summary.term ? (
        <div style={{ ...tile, minWidth: 'auto', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>{summary.term.name}</h2>
          <p style={{ margin: '4px 0 0' }}>
            {summary.term.sessionsPerClass} weekly sessions auto-created
            {summary.term.startDate && summary.term.endDate
              ? ` (${String(summary.term.startDate).slice(0, 10)} → ${String(summary.term.endDate).slice(0, 10)})`
              : ''}
          </p>
        </div>
      ) : (
        <div style={{ ...tile, minWidth: 'auto', marginBottom: 16 }}>
          <p style={{ margin: 0 }}>No term set up yet.</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={tile}><strong>{summary.classCount}</strong><br />classes</div>
        <div style={tile}><strong>{summary.teacherlessCount}</strong><br />without a teacher</div>
        <div style={tile}><strong>{summary.placedCount}</strong><br />students placed</div>
        <div style={tile}>
          <strong>{summary.unplacedCount}</strong><br />
          {summary.unplacedCount > 0 && canSetup ? (
            <Link href="/admin/sunday-school/setup?step=4">unplaced →</Link>
          ) : ('unplaced')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {canSetup && (
          <Link className="btn btn--style-primary btn--size-medium" href={`/admin/sunday-school/setup?step=${summary.term ? resume : 1}`}>
            {summary.term ? 'Continue setup' : 'Start setup'}
          </Link>
        )}
        <Link className="btn btn--style-secondary btn--size-medium" href="/admin/take-attendance">
          Take attendance
        </Link>
      </div>
    </div>
  )
}

export default HubClient
