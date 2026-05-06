import type { Form, FormSubmission } from '@/payload-types'

const TEMPLATE_RX = /\{\{\s*([\w]+)\s*\}\}/g
function interpolate(t: string, vars: Record<string, string>): string {
  return t.replace(TEMPLATE_RX, (_, k) => vars[k] ?? '')
}

async function sendOne({
  to,
  subject,
  text,
  replyTo,
}: {
  to: string
  subject: string
  text: string
  replyTo?: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@openmasjid.app'
  const fromName = process.env.EMAIL_FROM_NAME || 'OpenMasjid'
  if (!apiKey) {
    console.info('[form-notifications] RESEND_API_KEY unset; logging instead', { to, subject })
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${fromName} <${fromAddress}>`,
      to: [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })
  if (!res.ok) console.error('[form-notifications] Resend send failed', res.status)
}

export async function sendFormNotifications({
  form,
  submission,
}: {
  form: Form
  submission: FormSubmission
}) {
  const settings = form.settings ?? {}
  const recipients = (settings.notificationEmails ?? [])
    .map((e) => e.email)
    .filter(Boolean) as string[]
  const summary = Object.entries(submission.data as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    .join('\n')

  const adminSubject = `New submission: ${form.title}`
  const adminText = `Submitted at ${submission.submittedAt}\nFrom: ${submission.submitterEmail}\n\n${summary}`
  await Promise.all(
    recipients.map((to) =>
      sendOne({
        to,
        subject: adminSubject,
        text: adminText,
        replyTo: submission.submitterEmail || undefined,
      }),
    ),
  )

  if (settings.sendConfirmation && submission.submitterEmail) {
    const vars = {
      form: form.title,
      name: submission.submitterName || submission.submitterEmail,
    }
    const subject = interpolate(
      settings.confirmationSubject || `Thanks for submitting ${form.title}`,
      vars,
    )
    const body = interpolate(
      settings.confirmationBody || 'Thanks for your submission. We will be in touch.',
      vars,
    )
    await sendOne({ to: submission.submitterEmail, subject, text: body })
  }
}
