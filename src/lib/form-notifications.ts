import { getPayload } from 'payload'
import config from '@payload-config'
import type { Form, FormSubmission, Tenant } from '@/payload-types'
import { mediaUrl } from '@/components/types'
import { getRequestOrigin } from './seo'

const TEMPLATE_RX = /\{\{\s*([\w]+)\s*\}\}/g
function interpolate(t: string, vars: Record<string, string>): string {
  return t.replace(TEMPLATE_RX, (_, k) => vars[k] ?? '')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textToHtml(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br />')
}

function isValidHexColor(c: string | null | undefined): c is string {
  return !!c && /^#[0-9a-fA-F]{3,8}$/.test(c)
}

async function sendOne({
  to,
  subject,
  text,
  html,
  replyTo,
  fromName,
}: {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
  fromName?: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@openmasjid.app'
  const defaultFromName = process.env.EMAIL_FROM_NAME || 'OpenMasjid'
  const resolvedFromName = fromName || defaultFromName
  if (!apiKey) {
    console.info('[form-notifications] RESEND_API_KEY unset; logging instead', { to, subject })
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${resolvedFromName} <${fromAddress}>`,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })
  if (!res.ok) console.error('[form-notifications] Resend send failed', res.status)
}

function buildConfirmationHtml({
  tenantName,
  logoUrl,
  primaryColor,
  body,
  formTitle,
  footerAddress,
}: {
  tenantName: string
  logoUrl: string | null
  primaryColor: string
  body: string
  formTitle: string
  footerAddress: string | null
}): string {
  const safeName = escapeHtml(tenantName)
  const bodyHtml = textToHtml(body)
  const safeForm = escapeHtml(formTitle)
  const safeAddress = footerAddress ? textToHtml(footerAddress) : null
  const headerInner = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeName}" width="56" height="56" style="display:block;border:0;border-radius:8px;background:#ffffff;" />`
    : `<div style="font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:20px;font-weight:600;letter-spacing:0.2px;">${safeName}</div>`

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${safeForm}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
    <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(body).slice(0, 140)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f4f5;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
            <tr>
              <td align="center" style="background:${primaryColor};padding:24px 24px;">
                ${headerInner}
                ${logoUrl ? `<div style="margin-top:12px;font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:18px;font-weight:600;">${safeName}</div>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <div style="font-size:16px;line-height:1.6;color:#1f2937;">${bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px;">
                <div style="font-size:13px;line-height:1.5;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
                  This is a confirmation for your submission to <strong style="color:#374151;">${safeForm}</strong>.
                  ${safeAddress ? `<div style="margin-top:8px;">${safeAddress}</div>` : ''}
                </div>
              </td>
            </tr>
          </table>
          <div style="max-width:560px;margin:12px auto 0;padding:0 8px;font-size:12px;color:#9ca3af;text-align:center;">
            Sent by ${safeName}
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

async function loadTenant(form: Form): Promise<Tenant | null> {
  const tenantRef = form.tenant
  const tenantId =
    typeof tenantRef === 'object' && tenantRef !== null ? tenantRef.id : tenantRef
  if (tenantId == null) return null
  try {
    const payload = await getPayload({ config })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId as number,
      depth: 1,
      overrideAccess: true,
    })
    return tenant as Tenant
  } catch (err) {
    console.warn('[form-notifications] failed to load tenant for branding', err)
    return null
  }
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

  const tenant = await loadTenant(form)
  const tenantName = tenant?.name || process.env.EMAIL_FROM_NAME || 'OpenMasjid'

  const adminSubject = `New submission: ${form.title}`
  const adminText = `Submitted at ${submission.submittedAt}\nFrom: ${submission.submitterEmail}\n\n${summary}`
  await Promise.all(
    recipients.map((to) =>
      sendOne({
        to,
        subject: adminSubject,
        text: adminText,
        replyTo: submission.submitterEmail || undefined,
        fromName: tenantName,
      }),
    ),
  )

  if (settings.sendConfirmation && submission.submitterEmail) {
    const vars = {
      form: form.title,
      name: submission.submitterName || '',
    }
    const subject = interpolate(
      settings.confirmationSubject || `Thanks for submitting ${form.title}`,
      vars,
    )
    const body = interpolate(
      settings.confirmationBody || 'Thanks for your submission. We will be in touch.',
      vars,
    )

    let logoUrl: string | null = null
    const rawLogo = mediaUrl(tenant?.branding?.logo)
    if (rawLogo) {
      if (/^https?:\/\//i.test(rawLogo)) {
        logoUrl = rawLogo
      } else {
        const { origin } = await getRequestOrigin(
          tenant
            ? {
                id: tenant.id,
                slug: tenant.slug,
                customDomains: (tenant.customDomains ?? undefined) as never,
              }
            : null,
        ).catch(() => ({ origin: '' }))
        logoUrl = origin ? `${origin}${rawLogo}` : null
      }
    }

    const primaryColor = isValidHexColor(tenant?.branding?.primaryColor)
      ? (tenant!.branding!.primaryColor as string)
      : '#0F1E4A'

    const html = buildConfirmationHtml({
      tenantName,
      logoUrl,
      primaryColor,
      body,
      formTitle: form.title,
      footerAddress: tenant?.contactInfo?.address ?? null,
    })

    await sendOne({
      to: submission.submitterEmail,
      subject,
      text: body,
      html,
      fromName: tenantName,
    })
  }
}
