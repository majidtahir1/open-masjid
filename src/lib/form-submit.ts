// src/lib/form-submit.ts
import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import { validateSubmission, type FormSchema } from './form-schema'
import { checkRateLimit } from './form-rate-limit'
import { extractSubmitterName } from './form-submitter-name'

interface SubmitArgs {
  payload: Payload
  form: { id: string|number; tenant: { id: string|number } | string|number; title: string;
    status: string; schema: FormSchema; settings?: any; payment?: any }
  data: Record<string, unknown>
  ip: string
  userAgent: string
}

export type SubmitResult =
  | { ok: true; submissionId: string|number; checkoutPending: boolean }
  | { ok: false; error: 'rate_limited' | 'validation' | 'closed' | 'not_published'
       errors?: Record<string, string> }

export async function submitForm(args: SubmitArgs): Promise<SubmitResult> {
  const { payload, form, data, ip, userAgent } = args

  if (form.status !== 'published') return { ok: false, error: 'not_published' }

  // 1. Honeypot — silent success on bot
  if (data._hp) return { ok: true, submissionId: 0 as unknown as string, checkoutPending: false }

  // 2. Rate limit
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32)
  if (!checkRateLimit(`form:${form.id}:${ipHash}`)) return { ok: false, error: 'rate_limited' }

  // 3. Schema validation
  const v = validateSubmission(form.schema, data)
  if (!v.ok) return { ok: false, error: 'validation', errors: v.errors }

  // 4. Capacity
  const cap = form.settings?.capacity
  if (typeof cap === 'number' && cap > 0) {
    const counted = await payload.count({
      collection: 'form-submissions',
      where: { and: [
        { form: { equals: form.id } },
        { paymentStatus: { not_in: ['expired'] } },
      ] },
    })
    if (counted.totalDocs >= cap) return { ok: false, error: 'closed' }
  }

  // 5. Persist
  const paymentEnabled = Boolean(form.payment?.enabled)
  const tenantId = typeof form.tenant === 'object' ? form.tenant.id : form.tenant
  const created = await payload.create({
    collection: 'form-submissions',
    data: {
      tenant: tenantId,
      form: form.id,
      submitterEmail: typeof v.data.email === 'string' && v.data.email.length > 0 ? v.data.email : null,
      submitterName: extractSubmitterName(v.data),
      data: v.data,
      status: 'new',
      paymentStatus: paymentEnabled ? 'pending_payment' : 'na',
      submittedAt: new Date(),
      userAgent,
      ipHash,
    } as any,
    overrideAccess: true,
  })

  return { ok: true, submissionId: created.id, checkoutPending: paymentEnabled }
}
