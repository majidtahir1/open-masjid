'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarRange, GraduationCap, UserCheck, Users, Check, Sparkles } from 'lucide-react'
import { api } from './api'
import { buildHubSummary, firstIncompleteStep, type HubSummary } from '@/lib/school-setup'
import StepTerm from './steps/StepTerm'
import StepClasses from './steps/StepClasses'
import StepTeachers from './steps/StepTeachers'
import StepStudents from './steps/StepStudents'
import './sunday-school.css'

const EMPTY = buildHubSummary({ term: null, classes: [], enrollments: [], students: [], sessionsPerClass: 0 })

const STEPS = [
  { key: 'Term', icon: CalendarRange },
  { key: 'Classes', icon: GraduationCap },
  { key: 'Teachers', icon: UserCheck },
  { key: 'Students', icon: Users },
] as const

async function loadSummary(programId: string | null): Promise<HubSummary> {
  if (!programId) return EMPTY
  const term = await api(`/terms/${programId}?depth=0`)
  if (!term?.id) return EMPTY
  const classes = (await api(`/school-classes?where[term][equals]=${programId}&limit=1000&depth=0`)).docs
  const classIds = classes.map((c: any) => c.id)
  const enrollments = classIds.length
    ? (await api(`/enrollments?where[class][in]=${classIds.join(',')}&limit=5000&depth=0`)).docs
    : []
  const students = (await api('/students?where[status][equals]=active&limit=5000&depth=0')).docs
  return buildHubSummary({ term, classes, enrollments, students, sessionsPerClass: 0 })
}

/** Per-step completion, derived from data. Teachers (optional) completes once
 *  at least one class has a teacher. */
function doneFlags(s: HubSummary): boolean[] {
  return [
    !!s.term,
    s.classCount > 0,
    s.classCount > 0 && s.teacherlessCount < s.classCount,
    s.classCount > 0 && s.unplacedCount === 0 && s.placedCount > 0,
  ]
}

const SetupWizard: React.FC<{ programId: string | null; createMode: boolean }> = ({ programId, createMode }) => {
  const router = useRouter()
  const params = useSearchParams()
  const [step, setStep] = useState<number>(0)
  const [ready, setReady] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [summary, setSummary] = useState<HubSummary>(EMPTY)
  // Tracks the program being set up. Starts from the resolved prop, but in
  // create mode StepTerm reports the id of the newly-created program so the
  // later steps (and the URL) point at it.
  const [progId, setProgId] = useState<string | null>(programId)

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let active = true
    loadSummary(progId).then((s) => {
      if (!active) return
      setSummary(s)
      const qs = params.get('step')
      const resume = qs ? Number(qs) : (createMode && !progId ? 1 : firstIncompleteStep(s))
      setStep((cur) => (cur === 5 ? 5 : Math.min(Math.max(resume, 1), 4)))
      setReady(true)
    })
    return () => { active = false }
  }, [params, reloadKey, progId, createMode])

  const goto = (s: number) => {
    setStep(s)
    router.replace(`/admin/sunday-school/setup?step=${s}${progId ? `&program=${progId}` : ''}`)
  }

  if (!ready) return <div className="ss-root"><p className="ss-emptyline">Loading…</p></div>

  const done = doneFlags(summary)

  return (
    <div className="ss-root">
      <p className="ss-eyebrow">Programs</p>
      <h1 className="ss-display" style={{ fontSize: 28, marginBottom: 24 }}>Set up your program</h1>

      <div className="ss-wizard">
        <nav className="ss-rail" aria-label="Setup steps">
          {STEPS.map((s, i) => {
            const n = i + 1
            const Icon = s.icon
            const isDone = done[i] && step !== n
            const cls = `ss-railstep${step === n ? ' ss-railstep--active' : ''}${isDone ? ' ss-railstep--done' : ''}`
            return (
              <button key={s.key} className={cls} onClick={() => goto(n)} aria-current={step === n ? 'step' : undefined}>
                <span className="ss-railstep__node">{isDone ? <Check size={16} /> : <Icon size={16} />}</span>
                <span className="ss-railstep__body">
                  <span className="ss-railstep__k">Step {n}{i === 2 ? ' · optional' : ''}</span>
                  <span className="ss-railstep__label">{s.key}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div>
          {step === 1 && <StepTerm programId={progId} createMode={createMode && !progId} onNext={() => goto(2)} onChanged={refresh} onProgram={(id) => setProgId(String(id))} />}
          {step === 2 && <StepClasses programId={progId} onBack={() => goto(1)} onNext={() => goto(3)} onChanged={refresh} />}
          {step === 3 && <StepTeachers programId={progId} onBack={() => goto(2)} onNext={() => goto(4)} />}
          {step === 4 && <StepStudents programId={progId} onBack={() => goto(3)} onFinish={() => goto(5)} onChanged={refresh} />}
          {step === 5 && (
            <div className="ss-card">
              <div className="ss-finish">
                <span className="ss-finish__badge"><Sparkles size={26} /></span>
                <h2 className="ss-card__title" style={{ marginBottom: 4 }}>Your program is ready</h2>
                <p className="ss-card__hint" style={{ margin: '0 auto 4px' }}>
                  {summary.term?.name} is set up. You can take attendance any time from the dashboard.
                </p>
                <div className="ss-finish__summary">
                  <span><b>{summary.classCount}</b> classes</span>
                  <span><b>{summary.placedCount}</b> students</span>
                  <span><b>{summary.teacherlessCount}</b> classes need a teacher</span>
                </div>
                <div className="ss-foot" style={{ justifyContent: 'center' }}>
                  <button className="ss-btn" onClick={() => router.push('/admin/sunday-school')}>Go to dashboard</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SetupWizard
