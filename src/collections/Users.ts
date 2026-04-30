import type { CollectionConfig, Where } from 'payload'
import { withBillingLock } from '../access/billingLocked'

/**
 * Users — extends Payload's built-in auth.
 *
 * Roles:
 *  - platformOwner: manages all tenants
 *  - admin: full CRUD within their tenant
 *  - staff: limited CRUD (no user/settings management) within their tenant
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'User',
    plural: 'Users',
  },
  hooks: {
    afterLogin: [
      // Flip the user's tenant from 'pending' → 'trialing' on first successful
      // login. Cheap to run on every login: it's a no-op for already-active
      // tenants, and it removes the pending tenant from the 7-day cleanup
      // sweep. Errors are swallowed — login should never fail because of
      // this lifecycle bookkeeping.
      async ({ req, user }) => {
        try {
          const tenant = (user as { tenant?: unknown }).tenant
          const tenantId =
            typeof tenant === 'object' && tenant !== null && 'id' in tenant
              ? (tenant as { id: string | number }).id
              : (tenant as string | number | undefined)
          if (!tenantId) return
          const tenantDoc = (await req.payload.findByID({
            collection: 'tenants',
            id: tenantId,
            overrideAccess: true,
          })) as { status?: string } | null
          if (tenantDoc?.status === 'pending') {
            await req.payload.update({
              collection: 'tenants',
              id: tenantId,
              data: { status: 'trialing' },
              overrideAccess: true,
            })
          }
        } catch (err) {
          req.payload.logger.error(
            `users.afterLogin: failed to activate tenant: ${(err as Error).message}`,
          )
        }
      },
    ],
  },
  auth: {
    depth: 0,
    forgotPassword: {
      generateEmailSubject: () => 'Set your password — OpenMasjid',
      generateEmailHTML: async (args) => {
        const token = (args as { token?: string } | undefined)?.token ?? ''
        const req = (args as { req?: { payload?: unknown } } | undefined)?.req
        const user = (args as {
          user?: {
            email?: string
            firstName?: string | null
            tenant?: unknown
          }
        } | undefined)?.user
        const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
        // If the user is tenant-scoped (admin/staff), point the reset link at
        // their tenant subdomain so after setting a password they land in the
        // right admin. Platform owners keep the apex URL.
        const tenant = user?.tenant as
          | { slug?: string }
          | string
          | number
          | null
          | undefined
        let tenantSlug: string | undefined
        if (typeof tenant === 'object' && tenant !== null && 'slug' in tenant) {
          tenantSlug = (tenant as { slug?: string }).slug
        } else if ((typeof tenant === 'string' || typeof tenant === 'number') && req?.payload) {
          try {
            const payload = req.payload as {
              findByID: (a: { collection: string; id: string | number; overrideAccess?: boolean }) => Promise<{ slug?: string } | null>
            }
            const doc = await payload.findByID({
              collection: 'tenants',
              id: tenant,
              overrideAccess: true,
            })
            tenantSlug = doc?.slug
          } catch {
            // Fall through to apex URL.
          }
        }
        let resetBase = serverURL
        if (tenantSlug) {
          try {
            const url = new URL(serverURL)
            // Prepend the slug as a subdomain label. Works for both apex
            // (openmasjid.app → alnoor.openmasjid.app) and bare-host dev
            // (localhost → alnoor.localhost).
            url.hostname = `${tenantSlug}.${url.hostname}`
            resetBase = url.toString().replace(/\/$/, '')
          } catch {
            // Fall through to serverURL on any parse error.
          }
        }
        const link = `${resetBase}/admin/reset/${token}`
        const greeting = user?.firstName
          ? `Assalamu alaikum ${user.firstName},`
          : 'Assalamu alaikum,'
        return `
          <!doctype html>
          <html>
            <body style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
              <h1 style="font-size: 20px; margin: 0 0 16px;">OpenMasjid — set your password</h1>
              <p style="margin: 0 0 16px;">${greeting}</p>
              <p style="margin: 0 0 16px;">
                You've been invited to the OpenMasjid admin panel (or you asked to reset your password).
                Click the button below to set your password and sign in.
              </p>
              <p style="margin: 24px 0;">
                <a href="${link}" style="display: inline-block; background: #0F1E4A; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                  Set password
                </a>
              </p>
              <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
                This link is single-use. If the button doesn't work, paste this URL into your browser:
              </p>
              <p style="margin: 0 0 16px; font-size: 12px; color: #6b7280; word-break: break-all;">
                ${link}
              </p>
              <p style="margin: 24px 0 0; font-size: 12px; color: #9ca3af;">
                If you didn't expect this email, you can ignore it — no action is needed.
              </p>
            </body>
          </html>
        `
      },
    },
  },
  admin: {
    group: 'People',
    useAsTitle: 'email',
    defaultColumns: ['firstName', 'lastName', 'email', 'role', 'tenant'],
    description:
      'People who can log into the admin panel. Each non-platform user belongs to exactly one tenant and only sees that tenant\'s content.',
    components: {
      beforeListTable: ['/src/admin/InviteUserPanel#default'],
    },
  },
  access: {
    // Who can create a new user?
    create: withBillingLock(({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      // Admins can create users in their own tenant (hook will force tenant).
      return user.role === 'admin'
    }),
    // Who can read users?
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true

      // Staff: only themselves.
      if (user.role === 'staff') {
        const where: Where = { id: { equals: user.id } }
        return where
      }

      // Admin: all users in their tenant.
      if (user.role === 'admin') {
        const tenant = (user as { tenant?: unknown }).tenant
        const tenantId =
          typeof tenant === 'object' && tenant !== null && 'id' in tenant
            ? (tenant as { id: string | number }).id
            : (tenant as string | number | undefined)
        if (!tenantId) return false
        const where: Where = { tenant: { equals: tenantId } }
        return where
      }
      return false
    },
    // Who can update a user?
    update: withBillingLock(({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true

      if (user.role === 'staff') {
        const where: Where = { id: { equals: user.id } }
        return where
      }
      if (user.role === 'admin') {
        const tenant = (user as { tenant?: unknown }).tenant
        const tenantId =
          typeof tenant === 'object' && tenant !== null && 'id' in tenant
            ? (tenant as { id: string | number }).id
            : (tenant as string | number | undefined)
        if (!tenantId) return false
        const where: Where = { tenant: { equals: tenantId } }
        return where
      }
      return false
    }),
    // Who can delete a user?
    delete: withBillingLock(({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      if (user.role !== 'admin') return false
      const tenant = (user as { tenant?: unknown }).tenant
      const tenantId =
        typeof tenant === 'object' && tenant !== null && 'id' in tenant
          ? (tenant as { id: string | number }).id
          : (tenant as string | number | undefined)
      if (!tenantId) return false
      return { tenant: { equals: tenantId } }
    }),
  },
  fields: [
    {
      name: 'firstName',
      type: 'text',
      required: true,
      label: 'First name',
      admin: {
        description: 'First name, used for greetings and displayed in the admin panel',
        components: {
          Field: '/src/fields/TextField#default',
        },
      },
    },
    {
      name: 'lastName',
      type: 'text',
      required: true,
      label: 'Last name',
      admin: {
        description: 'Last name',
        components: {
          Field: '/src/fields/TextField#default',
        },
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'staff',
      label: 'Role',
      options: [
        { label: 'Platform Owner (manages all tenants)', value: 'platformOwner' },
        { label: 'Admin (full access within one tenant)', value: 'admin' },
        { label: 'Staff (content only within one tenant)', value: 'staff' },
      ],
      admin: {
        description:
          'Platform Owner manages every masjid and the platform itself. Admin can change settings, branding, and users within one masjid. Staff can add/edit content (events, prayer times, announcements) but cannot change settings or manage users.',
        components: {
          Field: '/src/fields/SelectField#default',
        },
      },
      access: {
        // Only platformOwner can change role to platformOwner; admins can set
        // admin/staff within their tenant. For simplicity we let admins update
        // role but not to platformOwner — guard via a validate hook.
        update: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'platformOwner' || user.role === 'admin'
        },
      },
      validate: (value: unknown, { req }: { req: { user?: unknown } }) => {
        const v = value as string
        const u = req?.user as { role?: string } | undefined
        // Allow platformOwner when there's no authenticated user — that's
        // Payload's create-first-user bootstrap path; the route is only
        // reachable when the users table is empty, so there's no risk of
        // unauthenticated escalation against an existing platform.
        if (!u) return true
        if (v === 'platformOwner' && u.role !== 'platformOwner') {
          return 'Only a platform owner can assign the platformOwner role.'
        }
        return true
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      label: 'Tenant',
      admin: {
        description:
          'Which masjid this user belongs to. Required for Admin and Staff; leave blank for Platform Owner (they access every tenant). Only a Platform Owner can change this field.',
      },
      // Required for admin/staff; optional for platformOwner. We enforce this
      // via validate because Payload requires `required` to be a static bool.
      validate: (value: unknown, { data }: { data?: { role?: string } }) => {
        const role = data?.role
        if (role === 'platformOwner') return true
        if (!value) return 'Tenant is required for admin and staff users.'
        return true
      },
      access: {
        // Only platformOwner can change a user's tenant.
        update: ({ req: { user } }) => {
          if (!user) return false
          return user.role === 'platformOwner'
        },
      },
    },
    {
      name: 'onboardingWelcomeSeenAt',
      type: 'date',
      admin: {
        description:
          'Set the first time this user sees the onboarding welcome dialog. Used to suppress re-showing it on subsequent logins.',
        readOnly: true,
        hidden: true,
      },
    },
  ],
}

export default Users
