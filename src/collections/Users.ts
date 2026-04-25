import type { CollectionConfig, Where } from 'payload'

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
  auth: {
    depth: 0,
    forgotPassword: {
      generateEmailSubject: () => 'Set your password — OpenMasjid',
      generateEmailHTML: (args) => {
        const token = (args as { token?: string } | undefined)?.token ?? ''
        const user = (args as { user?: { email?: string; firstName?: string | null } } | undefined)?.user
        const serverURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
        const link = `${serverURL}/admin/reset/${token}`
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
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'platformOwner') return true
      // Admins can create users in their own tenant (hook will force tenant).
      return user.role === 'admin'
    },
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
    update: ({ req: { user } }) => {
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
    },
    // Who can delete a user?
    delete: ({ req: { user } }) => {
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
    },
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
  ],
}

export default Users
