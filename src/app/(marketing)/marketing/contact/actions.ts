'use server'

const TO_ADDRESS = 'hello@openmasjid.app'

export interface ContactFormState {
  ok: boolean
  message: string
}

export async function submitContactForm(
  _prev: ContactFormState | null,
  formData: FormData,
): Promise<ContactFormState> {
  const honeypot = String(formData.get('company') ?? '')
  if (honeypot) {
    return { ok: true, message: 'Thanks — we will get back to you shortly.' }
  }

  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const masjid = String(formData.get('masjid') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()

  if (!name || !email || !message) {
    return { ok: false, message: 'Please fill in your name, email, and a message.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: 'That email address does not look right.' }
  }
  if (message.length > 5000) {
    return { ok: false, message: 'Message is too long. Please keep it under 5,000 characters.' }
  }

  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@openmasjid.app'
  const fromName = process.env.EMAIL_FROM_NAME || 'OpenMasjid'

  const subject = `Contact form: ${name}${masjid ? ` (${masjid})` : ''}`
  const text = [
    `From: ${name} <${email}>`,
    masjid ? `Masjid: ${masjid}` : null,
    '',
    message,
  ]
    .filter(Boolean)
    .join('\n')

  if (!apiKey) {
    console.info('[contact] RESEND_API_KEY unset; logging submission instead of sending', {
      to: TO_ADDRESS,
      subject,
      text,
    })
    return { ok: true, message: 'Thanks — we will get back to you shortly.' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [TO_ADDRESS],
        reply_to: email,
        subject,
        text,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[contact] Resend send failed', res.status, body)
      return { ok: false, message: 'Sorry, something went wrong sending your message. Please try again or email us directly.' }
    }
  } catch (err) {
    console.error('[contact] Resend send threw', err)
    return { ok: false, message: 'Sorry, something went wrong sending your message. Please try again or email us directly.' }
  }

  return { ok: true, message: 'Thanks — we will get back to you shortly.' }
}
