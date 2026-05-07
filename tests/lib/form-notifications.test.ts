import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendFormNotifications } from '@/lib/form-notifications'

const fetchSpy = vi.fn()
beforeEach(() => {
  fetchSpy.mockReset()
  global.fetch = fetchSpy as any
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
