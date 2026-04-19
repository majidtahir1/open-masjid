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
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['firstName', 'lastName', 'email', 'role', 'tenant'],
    description:
      'People who can log into the admin panel. Each non-platform user belongs to exactly one tenant and only sees that tenant\'s content.',
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
        if (v === 'platformOwner' && u?.role !== 'platformOwner') {
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
