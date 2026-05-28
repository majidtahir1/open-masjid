import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Announcements } from './collections/Announcements'
import { CarouselSlides } from './collections/CarouselSlides'
import { DonationFunds } from './collections/DonationFunds'
import { Members } from './collections/Members'
import { MembershipTiers } from './collections/MembershipTiers'
import { Donations } from './collections/Donations'
import { Events } from './collections/Events'
import { HeroSlides } from './collections/HeroSlides'
import { Kiosks } from './collections/Kiosks'
import { SponsorSlides } from './collections/SponsorSlides'
import { WeeklyEventsSlides } from './collections/WeeklyEventsSlides'
import { Media } from './collections/Media'
import { Forms } from './collections/Forms'
import { FormSubmissions } from './collections/FormSubmissions'
import { Pages } from './collections/Pages'
import { PrayerDisplayContent } from './collections/PrayerDisplayContent'
import { PrayerSchedules } from './collections/PrayerSchedules'
import { QRCodes } from './collections/QRCodes'
import { Services } from './collections/Services'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { applyIqamahRulesEndpoint } from './endpoints/applyIqamahRules'
import { createTenantEndpoint } from './endpoints/createTenant'
import { generatePrayerTimesEndpoint } from './endpoints/generatePrayerTimes'
import { inviteUserEndpoint } from './endpoints/inviteUser'
import { runJobsDevEndpoint } from './endpoints/runJobsDev'
import { withApiKeyScopeEnforcement } from './access/apiScoped'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Email adapter config.
 *
 * When RESEND_API_KEY is set, outgoing mail (forgot-password, invites, etc.)
 * is sent via Resend. Without it, Payload falls back to logging email content
 * to the console — fine for local dev, unsuitable for any deployed env.
 *
 * Sender identity comes from `EMAIL_FROM_ADDRESS` (required when Resend is on)
 * and optional `EMAIL_FROM_NAME` (defaults to "OpenMasjid"). In production the
 * from-address domain must be verified in your Resend dashboard; in dev you
 * can use `onboarding@resend.dev`.
 */
function email() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return undefined
  const fromAddress = process.env.EMAIL_FROM_ADDRESS ?? 'onboarding@resend.dev'
  const fromName = process.env.EMAIL_FROM_NAME ?? 'OpenMasjid'
  return resendAdapter({
    defaultFromAddress: fromAddress,
    defaultFromName: fromName,
    apiKey,
  })
}

export default buildConfig({
  admin: {
    user: 'users',
    meta: {
      title: 'OpenMasjid Admin',
      description: 'Content management for masajid',
      titleSuffix: ' — OpenMasjid',
    },
    components: {
      // Sidebar order intent (top → bottom), achieved via CSS `order` in NavOrder:
      //   1. Dashboard
      //   2. Prayer group        (native)
      //   3. Donations           (custom link, slotted between Prayer and Content)
      //   4. Content group       (native)
      //   5. Library group       (native — Media)
      //   6. View public site    (custom)
      //   7. Site Settings       (custom, margin-top:auto pins it to the bottom)
      //
      // Billing has been removed from the sidebar entirely; it lives as a tab
      // inside the tenant edit page (Site Settings → Billing tab) so masjid
      // admins don't have to look at it day-to-day.
      beforeNavLinks: [
        '/src/admin/BillingBanner#default',
        '/src/admin/onboarding/OnboardingBanner#default',
        '/src/admin/DashboardLink#default',
        '/src/admin/donations/DonationsNav#default',
        '/src/admin/membership/MembershipNav#default',
      ],
      afterNavLinks: [
        '/src/admin/ViewPublicSiteLink#default',
        '/src/admin/ProfileLink#default',
        '/src/admin/SiteSettingsCluster#default',
      ],
      header: [
        '/src/admin/Favicon#default',
        '/src/admin/HideTenantsNav#default',
        '/src/admin/donations/HideDonationsCollections#default',
        '/src/admin/HideMediaAndPeopleNav#default',
        '/src/admin/NavOrder#default',
        '/src/admin/TenantThemeStyle#default',
      ],
      graphics: {
        Logo: '/src/admin/Logo#default',
      },
      views: {
        dashboard: {
          Component: '/src/admin/Dashboard#default',
        },
        // The login screen is replaced via a Next.js file-system route at
        // `src/app/(payload)/admin/login/page.tsx`. Payload 3.39 does not
        // expose `views.login` as an override, so the route-level swap is
        // the cleanest way to keep the built-in admin shell intact while
        // fully owning the login UI.
      },
    },
  },
  // Order matters — Payload renders sidebar groups in the order their first
  // collection appears here. Desired order: Prayer, Content, Donations,
  // (Library hidden), (People hidden), (Site hidden via HideTenantsNav).
  // Every collection's access functions are wrapped with
  // `withApiKeyScopeEnforcement` so a key with non-empty `apiScopes` is
  // default-deny everywhere except for the (slug, op) pairs declared in
  // `src/access/apiScoped.ts#SCOPE_MAP`. UI sessions and keys with empty
  // scopes are unaffected.
  collections: [
    PrayerSchedules,
    PrayerDisplayContent,
    Events,
    HeroSlides,
    CarouselSlides,
    SponsorSlides,
    WeeklyEventsSlides,
    Kiosks,
    QRCodes,
    Announcements,
    Services,
    Pages,
    Forms,
    FormSubmissions,
    DonationFunds,
    Donations,
    MembershipTiers,
    Members,
    Media,
    Users,
    Tenants,
  ].map(withApiKeyScopeEnforcement),
  endpoints: [
    generatePrayerTimesEndpoint,
    applyIqamahRulesEndpoint,
    inviteUserEndpoint,
    runJobsDevEndpoint,
    createTenantEndpoint,
  ],
  jobs: {
    // Dev: `src/instrumentation.ts` ticks the queue every 30s.
    // Prod: a crontab on the host POSTs to `/api/payload-jobs/run` every
    //       minute with `X-Cron-Secret: $CRON_SECRET`. Authenticated admins
    //       can also trigger a manual run from the browser.
    access: {
      run: ({ req }) => {
        if (req.user) return true
        const provided = req.headers.get('x-cron-secret') ?? ''
        const expected = process.env.CRON_SECRET ?? ''
        // Reject when no secret is configured — avoids accidentally exposing
        // an unauthenticated job runner in a prod where the env var is unset.
        if (!expected) return false
        // Constant-time compare to defuse timing attacks on the secret.
        if (provided.length !== expected.length) return false
        let diff = 0
        for (let i = 0; i < provided.length; i++) {
          diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
        }
        return diff === 0
      },
    },
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
    // Use explicit migrations in production. Auto-push only in dev so
    // local schema iteration stays fast; the Docker prod image runs
    // `npx payload migrate` before booting the app (see compose `migrate`
    // service). Override with PAYLOAD_DB_PUSH=true if you ever need
    // auto-push in a deployed env.
    // Auto-push has been disabled because drizzle's schema diff regenerates
    // a broken `text → enum` ALTER for `_hero_slides_v.version_split_fields_photo_tone`
    // on every boot (no USING clause), failing the whole transaction. All
    // schema changes go through explicit migrations via `npx payload migrate:create`.
    // Re-enable temporarily by setting PAYLOAD_DB_PUSH=true if you ever need to.
    push: process.env.PAYLOAD_DB_PUSH === 'true',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  email: email(),
  sharp,
})
