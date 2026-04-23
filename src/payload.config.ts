import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Announcements } from './collections/Announcements'
import { Events } from './collections/Events'
import { HeroSlides } from './collections/HeroSlides'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { PrayerSchedules } from './collections/PrayerSchedules'
import { Services } from './collections/Services'
import { Tenants } from './collections/Tenants'
import { Users } from './collections/Users'
import { applyIqamahRulesEndpoint } from './endpoints/applyIqamahRules'
import { generatePrayerTimesEndpoint } from './endpoints/generatePrayerTimes'
import { inviteUserEndpoint } from './endpoints/inviteUser'

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
      beforeNavLinks: [
        '/src/admin/DashboardLink#default',
        '/src/admin/SiteSettingsLink#default',
        '/src/admin/InviteLink#default',
      ],
      afterNavLinks: ['/src/admin/ViewPublicSiteLink#default'],
      header: [
        '/src/admin/Favicon#default',
        '/src/admin/HideTenantsNav#default',
      ],
      graphics: {
        Logo: '/src/admin/Logo#default',
      },
      views: {
        dashboard: {
          Component: '/src/admin/Dashboard#default',
        },
        invite: {
          Component: '/src/admin/InvitePage#default',
          path: '/invite',
        },
        // The login screen is replaced via a Next.js file-system route at
        // `src/app/(payload)/admin/login/page.tsx`. Payload 3.39 does not
        // expose `views.login` as an override, so the route-level swap is
        // the cleanest way to keep the built-in admin shell intact while
        // fully owning the login UI.
      },
    },
  },
  collections: [
    Users,
    Tenants,
    Media,
    Events,
    HeroSlides,
    PrayerSchedules,
    Announcements,
    Services,
    Pages,
  ],
  endpoints: [generatePrayerTimesEndpoint, applyIqamahRulesEndpoint, inviteUserEndpoint],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  email: email(),
  sharp,
})
