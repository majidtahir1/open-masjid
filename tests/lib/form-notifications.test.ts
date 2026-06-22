import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildSubmissionSummary, sendFormNotifications } from '@/lib/form-notifications'

const fetchSpy = vi.fn()
beforeEach(() => {
  fetchSpy.mockReset()
  global.fetch = fetchSpy as any
})

describe('buildSubmissionSummary', () => {
  it('renders flat fields as key: value (arrays comma-joined)', () => {
    const out = buildSubmissionSummary({ name: 'Aisha', days: ['sat', 'sun'] })
    expect(out).toBe('name: Aisha\ndays: sat, sun')
  })

  it('renders a repeatable-group array as indented numbered sub-lines', () => {
    const out = buildSubmissionSummary({
      guardian_name: 'Aisha',
      children: [
        { child_first: 'Yusuf', child_grade: '3' },
        { child_first: 'Maryam', child_grade: '5' },
      ],
    })
    expect(out).not.toContain('[object Object]')
    expect(out).toContain('children:')
    expect(out).toContain('  1. child_first: Yusuf, child_grade: 3')
    expect(out).toContain('  2. child_first: Maryam, child_grade: 5')
  })
})

describe('sendFormNotifications', () => {
  const form = {
    title: 'Iftar RSVP',
    settings: {
      notificationEmails: [{ email: 'admin@m.org' }],
      sendConfirmation: true,
      confirmationSubject: 'Thanks for registering for {{form}}',
      confirmationBody: 'Salam {{name}} — see you Friday.',
    },
  } as any
  const submission = {
    submitterEmail: 's@x.com',
    submitterName: 'Aisha',
    data: { name: 'Aisha', email: 's@x.com' },
  } as any

  it('logs and returns when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY
    await sendFormNotifications({ form, submission })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends one admin email per recipient + one confirmation when configured', async () => {
    process.env.RESEND_API_KEY = 're_test'
    fetchSpy.mockResolvedValue({ ok: true })
    await sendFormNotifications({ form, submission })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('includes a branded html body on the confirmation email', async () => {
    process.env.RESEND_API_KEY = 're_test'
    fetchSpy.mockResolvedValue({ ok: true })
    await sendFormNotifications({ form, submission })
    const confirmationCall = fetchSpy.mock.calls.find(([, init]) => {
      const body = JSON.parse((init as { body: string }).body)
      return body.to[0] === 's@x.com'
    })
    expect(confirmationCall).toBeDefined()
    const body = JSON.parse((confirmationCall![1] as { body: string }).body)
    expect(body.html).toContain('<!doctype html>')
    expect(body.html).toContain('Salam Aisha — see you Friday.')
    expect(body.text).toBe('Salam Aisha — see you Friday.')
  })
})
