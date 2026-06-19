'use client'
import React from 'react'
import Link from 'next/link'
import { CalendarDays, GraduationCap, UserCheck, Users, ArrowRight, CalendarPlus, ClipboardCheck } from 'lucide-react'
import type { HubSummary } from '@/lib/school-setup'
import { firstIncompleteStep, formatDays } from '@/lib/school-setup'
import SessionTimeline from './SessionTimeline'
import './sunday-school.css'

const fmt = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '')

const HubClient: React.FC<{ summary: HubSummary; canSetup: boolean }> = ({ summary, canSetup }) => {
  const { term } = summary
  const resume = firstIncompleteStep(summary)

  return (
    <div className="ss-root">
      {term ? (
        <header className="ss-masthead">
          <p className="ss-eyebrow">Programs · current program</p>
          <h1 className="ss-masthead__title">{term.name}</h1>
          <p className="ss-masthead__meta">
            {formatDays(term.meetingDays)}
            {term.startDate && term.endDate ? ` · ${fmt(term.startDate)} → ${fmt(term.endDate)}` : ''}
            {` · ${term.sessionsPerClass} sessions per class, created automatically`}
          </p>
          <SessionTimeline
            startDate={term.startDate}
            endDate={term.endDate}
            meetingDays={term.meetingDays}
            holidays={term.holidays}
            variant="masthead"
          />
          <div className="ss-rhythm-legend">
            <span className="ss-rhythm-legend__item">
              <i className="ss-rhythm-legend__dot" />
              Class day
            </span>
            <span className="ss-rhythm-legend__item">
              <i className="ss-rhythm-legend__dot ss-rhythm-legend__dot--off" />
              <span style={{ textDecoration: 'line-through' }}>Day off</span>
            </span>
          </div>
        </header>
      ) : (
        <section className="ss-empty">
          <p className="ss-eyebrow">Programs</p>
          <h1 className="ss-empty__title">Let&apos;s set up your school</h1>
          <p className="ss-empty__body">
            Start with a term — its dates and weekly meeting day. Every class you add gets its weekly
            sessions created automatically, so you never schedule them by hand.
          </p>
          {canSetup && (
            <Link className="ss-btn" href="/admin/programs/setup?step=1">
              <CalendarPlus size={18} /> Start setup
            </Link>
          )}
        </section>
      )}

      {term && (
        <>
          <div className="ss-stats">
            <div className="ss-stat">
              <span className="ss-stat__icon"><GraduationCap size={19} /></span>
              <div className="ss-stat__num">{summary.classCount}</div>
              <div className="ss-stat__label">{summary.classCount === 1 ? 'class' : 'classes'}</div>
            </div>
            <div className={`ss-stat${summary.teacherlessCount > 0 ? ' ss-stat--warn' : ''}`}>
              <span className="ss-stat__icon"><UserCheck size={19} /></span>
              <div className="ss-stat__num">{summary.teacherlessCount}</div>
              <div className="ss-stat__label">without a teacher</div>
            </div>
            <div className="ss-stat ss-stat--good">
              <span className="ss-stat__icon"><Users size={19} /></span>
              <div className="ss-stat__num">{summary.placedCount}</div>
              <div className="ss-stat__label">students placed</div>
            </div>
            <div className={`ss-stat${summary.unplacedCount > 0 ? ' ss-stat--warn' : ''}`}>
              <span className="ss-stat__icon"><CalendarDays size={19} /></span>
              <div className="ss-stat__num">{summary.unplacedCount}</div>
              <div className="ss-stat__label">awaiting a class</div>
              {summary.unplacedCount > 0 && canSetup && (
                <Link className="ss-stat__link" href="/admin/programs/setup?step=4">Place them →</Link>
              )}
            </div>
          </div>

          <p className="ss-explainer">
            A <strong>term</strong> holds <strong>classes</strong>. Each class meets weekly, and its{' '}
            <strong>sessions are created automatically</strong> from the term&apos;s dates — those are the
            beads above. Students enroll into classes, and you mark attendance per session.
          </p>

          <div className="ss-actions">
            {canSetup && (
              <Link className="ss-btn" href={`/admin/programs/setup?step=${resume}`}>
                <ArrowRight size={18} /> Continue setup
              </Link>
            )}
            <Link className="ss-btn ss-btn--ghost" href="/admin/take-attendance">
              <ClipboardCheck size={18} /> Take attendance
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default HubClient
