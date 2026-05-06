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
})
