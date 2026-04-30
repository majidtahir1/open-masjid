import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import {
  checkIpThrottle,
  suggestAlternativeSlugs,
  validateEmail,
  validateSlug,
} from '@/lib/signup'

/**
 * Public signup endpoint. Creates a tenant + admin user atomically and
 * triggers Payload's forgot-password flow so the new admin receives a
 * "set your password" email.
 *
 * Failure modes are treated like this:
 *  - tenant insert fails           → return 500, nothing created
 *  - user insert fails             → delete tenant, return 500
 *  - forgotPassword email fails    → tenant + user remain (admin can use
 *                                    "forgot password" later); we still
 *                                    return 200 so the user sees the
 *                                    "check your email" screen, but log
 *                                    the failure so it can be retried.
 */

type SignupBody = {
  masjidName?: string
  subdomain?: string
  firstName?: string
  lastName?: string
  role?: string
  email?: string
  migrationSource?: string
  /** Honeypot — bots fill this; humans never see it. */
  website?: string
}

const TRIAL_DAYS = 14

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as SignupBody

  // Honeypot: silently succeed so the bot doesn't retry, but create nothing.
  if (body.website && body.website.trim() !== '') {
    return NextResponse.json({ ok: true, email: body.email ?? '' })
  }

  const ip = clientIp(req)
  const throttle = checkIpThrottle(ip)
  if (!throttle.ok) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(throttle.retryAfterSeconds ?? 3600) } },
    )
  }

  const masjidName = (body.masjidName ?? '').trim()
  const subdomain = (body.subdomain ?? '').trim().toLowerCase()
  const firstName = (body.firstName ?? '').trim()
  const lastName = (body.lastName ?? '').trim()
  const role = (body.role ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const migrationSource = (body.migrationSource ?? '').trim()

  const errors: Record<string, string> = {}
  if (!masjidName) errors.masjidName = 'Masjid name is required.'
  if (!subdomain) errors.subdomain = 'Subdomain is required.'
  if (!firstName) errors.firstName = 'Your name is required.'
  if (!email) errors.email = 'Email is required.'
  else if (!validateEmail(email)) errors.email = 'Enter a valid email address.'

  const slugProblem = subdomain ? validateSlug(subdomain) : 'format'
  if (subdomain && slugProblem === 'format') {
    errors.subdomain = 'Use lowercase letters, numbers, and hyphens (3–32 chars).'
  } else if (slugProblem === 'reserved') {
    errors.subdomain = 'That subdomain is reserved. Try a different one.'
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation', fields: errors }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // Slug collision → return suggestions.
  const slugTaken = await payload.find({
    collection: 'tenants',
    where: { slug: { equals: subdomain } },
    limit: 1,
    overrideAccess: true,
  })
  if (slugTaken.docs.length > 0) {
    const candidates = suggestAlternativeSlugs(subdomain)
    const available: string[] = []
    for (const candidate of candidates) {
      const hit = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: candidate } },
        limit: 1,
        overrideAccess: true,
      })
      if (hit.docs.length === 0) available.push(candidate)
    }
    return NextResponse.json(
      {
        error: 'slug-taken',
        message: `The subdomain "${subdomain}" is already in use.`,
        suggestions: available,
      },
      { status: 409 },
    )
  }

  // Email collision → tell the user to sign in instead.
  const emailTaken = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
  })
  if (emailTaken.docs.length > 0) {
    return NextResponse.json(
      {
        error: 'email-taken',
        message: 'An account with that email already exists. Sign in instead.',
      },
      { status: 409 },
    )
  }

  let tenantId: string | number | null = null
  try {
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const tenant = (await payload.create({
      collection: 'tenants',
      data: {
        name: masjidName,
        slug: subdomain,
        siteType: 'masjid',
        status: 'pending',
        trialEndsAt,
        signupMetadata: {
          role,
          migrationSource,
          ip,
          userAgent: req.headers.get('user-agent') ?? null,
          submittedAt: new Date().toISOString(),
        },
      },
      overrideAccess: true,
    })) as { id: string | number }
    tenantId = tenant.id

    const placeholderPassword = crypto.randomBytes(32).toString('hex')
    await payload.create({
      collection: 'users',
      data: {
        email,
        password: placeholderPassword,
        role: 'admin',
        tenant: tenantId as number,
        firstName,
        lastName,
      },
      overrideAccess: true,
    })

    // Create the Stripe Customer now so we can attach a subscription later
    // without juggling state. Failure to reach Stripe should not break signup —
    // admins can retry from the billing page once they're logged in.
    try {
      const { getStripe } = await import('@/lib/stripe')
      const { createCustomerForTenant } = await import('@/lib/billing-stripe-customer')
      const stripeCustomerId = await createCustomerForTenant(getStripe(), {
        tenantId: tenantId!,
        slug: subdomain,
        name: masjidName,
        email,
      })
      await payload.update({
        collection: 'tenants',
        id: tenantId!,
        data: { stripeCustomerId },
        overrideAccess: true,
      })
    } catch (stripeErr) {
      payload.logger.error(
        `signup: tenant ${tenantId} created but Stripe customer creation failed: ${(stripeErr as Error).message}`,
      )
      // Continue — billing page will create the customer lazily if missing.
    }

    try {
      await payload.forgotPassword({
        collection: 'users',
        data: { email },
      })
    } catch (emailErr) {
      payload.logger.error(
        `signup: tenant ${tenantId} created but forgot-password email failed: ${(emailErr as Error).message}`,
      )
      // Don't fail the request — admin can use "forgot password" later.
    }

    return NextResponse.json({ ok: true, email })
  } catch (err) {
    if (tenantId) {
      try {
        await payload.delete({ collection: 'tenants', id: tenantId, overrideAccess: true })
      } catch {
        payload.logger.error(`signup: failed to roll back tenant ${tenantId} after error`)
      }
    }
    payload.logger.error(`signup: ${(err as Error).message}`)
    return NextResponse.json(
      { error: 'server', message: 'Something went wrong creating your masjid. Please try again.' },
      { status: 500 },
    )
  }
}
