'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api } from './api'
import { buildHubSummary, firstIncompleteStep, type HubSummary } from '@/lib/school-setup'
import StepTerm from './steps/StepTerm'
import StepClasses from './steps/StepClasses'
import StepTeachers from './steps/StepTeachers'
import StepStudents from './steps/StepStudents'

const STEPS = ['Term', 'Classes', 'Teachers', 'Students'] as const

async function loadSummary(): Promise<{ summary: HubSummary; termId: string | number | null }> {
  const termRes = await api('/terms?where[status][equals]=active&sort=-startDate&limit=1&depth=0')
  const term = termRes.docs[0] ?? null
  if (!term) return { summary: buildHubSummary({ term: null, classes: [], enrollments: [], students: [], sessionsPerClass: 0 }), termId: null }
  const classes = (await api(`/school-classes?where[term][equals]=${term.id}&limit=1000&depth=0`)).docs
  const classIds = classes.map((c: any) => c.id)
  const enrollments = classIds.length
    ? (await api(`/enrollments?where[class][in]=${classIds.join(',')}&limit=5000&depth=0`)).docs
    : []
  const students = (await api('/students?where[status][equals]=active&limit=5000&depth=0')).docs
  const summary = buildHubSummary({ term, classes, enrollments, students, sessionsPerClass: 0 })
  return { summary, termId: term.id }
}

const SetupWizard: React.FC = () => {
  const router = useRouter()
  const params = useSearchParams()
  const [step, setStep] = useState<number>(0)
  const [ready, setReady] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let active = true
    loadSummary().then(({ summary }) => {
      if (!active) return
      const qs = params.get('step')
      const resume = qs ? Number(qs) : firstIncompleteStep(summary)
      setStep(Math.min(Math.max(resume, 1), 4))
      setReady(true)
    })
    return () => { active = false }
  }, [params, reloadKey])

  const goto = (s: number) => {
    setStep(s)
    router.replace(`/admin/sunday-school/setup?step=${s}`)
  }

  if (!ready) return <div style={{ padding: '1.5rem' }}>Loading…</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: 880 }}>
      <h1>Set up Sunday School</h1>
      <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, marginBottom: 24 }}>
        {STEPS.map((label, i) => {
          const n = i + 1
          return (
            <li key={label}>
              <button
                onClick={() => goto(n)}
                style={{ fontWeight: step === n ? 700 : 400, textDecoration: step === n ? 'underline' : 'none' }}
              >
                {n}. {label}
              </button>
            </li>
          )
        })}
      </ol>

      {step === 1 && <StepTerm onNext={() => goto(2)} onChanged={refresh} />}
      {step === 2 && <StepClasses onBack={() => goto(1)} onNext={() => goto(3)} onChanged={refresh} />}
      {step === 3 && <StepTeachers onBack={() => goto(2)} onNext={() => goto(4)} />}
      {step === 4 && <StepStudents onBack={() => goto(3)} onFinish={() => router.push('/admin/sunday-school')} onChanged={refresh} />}
    </div>
  )
}

export default SetupWizard
