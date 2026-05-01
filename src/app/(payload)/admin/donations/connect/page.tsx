import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  createLocalReq,
  getPayload,
  isEntityHidden,
  type SanitizedPermissions,
  type VisibleEntities,
} from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { importMap } from '../../importMap'
import ConnectClient from './ConnectClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SearchParams = Promise<{ status?: string | string[] }>

export default async function DonationsConnectPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const payload = await getPayload({ config, importMap })
  const reqHeaders = await headers()
  const { user, permissions } = await payload.auth({ headers: reqHeaders })
  if (!user) redirect('/admin/login')

  const req = await createLocalReq({ user }, payload)

  const visibleEntities: VisibleEntities = {
    collections: payload.config.collections
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
    globals: payload.config.globals
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
  }

  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? (user.tenant as { id: string | number }).id
      : (user.tenant as string | number | undefined)

  const params = (await searchParams) ?? {}
  const rawStatus = params.status
  const status = Array.isArray(rawStatus) ? rawStatus[0] ?? null : rawStatus ?? null

  let body: React.ReactNode
  if (!tenantId) {
    body = (
      <main className="mx-auto max-w-[820px] px-6 py-10 md:px-10 md:py-12">
        <h1 className="mb-4 font-display text-[40px] font-medium leading-[1.08] tracking-tight text-fg1">
          Donations
        </h1>
        <p className="font-body text-fs-base text-fg2">
          Platform owners do not have a Stripe Connect account.
        </p>
      </main>
    )
  } else {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      overrideAccess: true,
    })) as unknown as {
      name: string
      stripeAccountId?: string | null
      stripeChargesEnabled?: boolean | null
      stripePayoutsEnabled?: boolean | null
    }

    body = (
      <ConnectClient
        tenantName={tenant.name}
        stripeAccountId={tenant.stripeAccountId ?? null}
        chargesEnabled={Boolean(tenant.stripeChargesEnabled)}
        payoutsEnabled={Boolean(tenant.stripePayoutsEnabled)}
        status={status}
      />
    )
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      params={{}}
      payload={payload}
      permissions={permissions as SanitizedPermissions}
      req={req}
      searchParams={{}}
      user={user}
      visibleEntities={visibleEntities}
    >
      {body}
    </DefaultTemplate>
  )
}
