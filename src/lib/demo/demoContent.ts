/**
 * Pure data constants for the public demo tenant (Masjid al-Noor — Demo).
 *
 * These are consumed by the shared seed/reset engine (`seedDemo.ts`). They
 * intentionally hold NO Stripe account id — that comes from the environment via
 * `demoDonationConfig()` so it never lands in source control.
 *
 * Field names / enum values below are copied verbatim from the real
 * collections (MembershipTiers, Events, Announcements, Forms, Tenants); do not
 * invent enum values.
 */

export const DEMO_SLUG = 'demo'

/**
 * Tenant document for the demo masjid, WITHOUT `donationConfig` (that's built
 * separately by `demoDonationConfig()` since the Stripe account id is in env).
 */
export const demoTenantData = {
  name: 'Masjid al-Noor (Demo)',
  slug: DEMO_SLUG,
  siteType: 'masjid' as const,
  demoMode: true,
  status: 'grandfathered' as const,
  branding: {
    primaryColor: '#0F1E4A',
    secondaryColor: '#28A0B4',
    accentColor: '#F0C88C',
    displayFont: 'Fraunces' as const,
  },
  contactInfo: {
    phone: '+1 (555) 010-2030',
    email: 'salaam@demo.openmasjid.app',
    address: '100 Community Way, Demo City, TX 75000',
  },
  footerTagline: 'A friendly place to see OpenMasjid in action',
  location: { lat: 32.7767, lng: -96.797, timezone: 'America/Chicago' },
  prayerCalc: { method: 'ISNA' as const, asrMadhab: 'Standard' as const },
} as const

/**
 * Donation config for the demo tenant. The Stripe account id is a TEST
 * connected account id read from `DEMO_STRIPE_ACCOUNT_ID`. Throws if unset so a
 * misconfigured deploy fails loudly rather than silently seeding a broken demo.
 */
export function demoDonationConfig() {
  const acct = process.env.DEMO_STRIPE_ACCOUNT_ID
  if (!acct) throw new Error('DEMO_STRIPE_ACCOUNT_ID is not set')
  return {
    mode: 'connect' as const,
    stripeAccountId: acct,
    stripeChargesEnabled: true,
  }
}

/**
 * Membership tiers. `amount` is in DOLLARS (the virtual field) — the collection's
 * beforeValidate hook derives the persisted `amountCents`. `cadence` is the
 * MembershipTiers enum: 'monthly' | 'yearly'.
 */
export const demoMembershipTiers = [
  { name: 'Supporter', amount: 10, cadence: 'monthly' as const, active: true, sortOrder: 1 },
  { name: 'Family', amount: 25, cadence: 'monthly' as const, active: true, sortOrder: 2 },
  { name: 'Patron', amount: 100, cadence: 'yearly' as const, active: true, sortOrder: 3 },
] as const

/** Announcements. `priority` is the Announcements enum: 'normal' | 'high'. */
export const demoAnnouncements = [
  { title: 'Welcome to the OpenMasjid demo', priority: 'normal' as const, active: true },
  { title: 'Jumu’ah khutbah begins at 1:30 PM', priority: 'high' as const, active: true },
] as const

/**
 * Events. `tag`/`audience`/`displayMode` use the Events collection enums
 * verbatim. `displayMode` is required (default 'text'). `description` (richText)
 * is optional in the collection; the seed engine fills it from
 * `shortDescription` via the `richText()` helper.
 */
export const demoEvents = [
  {
    title: 'Weekly Halaqa',
    slug: 'weekly-halaqa',
    shortDescription: 'A weekly circle of knowledge after Isha.',
    tag: 'weekly-class' as const,
    when: 'Wednesdays after Isha',
    displayMode: 'text' as const,
    location: 'Main prayer hall',
    audience: ['all' as const],
  },
  {
    title: 'Community Iftar',
    slug: 'community-iftar',
    shortDescription: 'Open iftar for the whole community.',
    tag: 'community' as const,
    when: 'Every Saturday in Ramadan',
    displayMode: 'text' as const,
    location: 'Community hall',
    audience: ['families' as const, 'all' as const],
  },
] as const

/**
 * A sample published form. `status` is the Forms enum ('published'). `schema`
 * satisfies the form-schema Zod validator: each field needs `id`, `name`
 * (matching /^[a-z][a-z0-9_]*$/), `label`, and a `type` from FIELD_TYPES
 * ('short-text', 'number', …) — NOT a raw 'text'.
 */
export const demoForm = {
  title: 'Eid Dinner RSVP (Demo)',
  slug: 'eid-dinner-rsvp',
  status: 'published' as const,
  schema: {
    steps: [
      {
        id: 's1',
        fields: [
          { id: 'name', name: 'name', type: 'short-text', label: 'Your name', required: true },
          { id: 'guests', name: 'guests', type: 'number', label: 'Number of guests', required: true },
        ],
      },
    ],
  },
  settings: { submitButtonLabel: 'RSVP', sendConfirmation: false },
} as const
