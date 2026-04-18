import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: 'users',
    meta: {
      title: 'OpenMasjid Admin',
      description: 'Content management for masajid',
      titleSuffix: ' — OpenMasjid',
      icons: [
        {
          // TODO: resolve per-tenant favicon once tenant resolution at admin time is wired up.
          url: '/brand/logo-icp.jpg',
          rel: 'icon',
          type: 'image/jpeg',
        },
      ],
    },
    components: {
      graphics: {
        Logo: '/src/admin/Logo#default',
        Icon: '/src/admin/Logo#default',
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
  sharp,
})
