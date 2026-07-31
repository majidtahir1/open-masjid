import { getAdminUser, getAdminTenant } from '@/lib/admin-context'
import { getTenantBillingState, type BillingTenantFields } from '@/lib/billing'

export default async function BillingBanner() {
  const { user } = await getAdminUser()
  if (!user || user.role === 'platformOwner') return null

  const tenantId =
    typeof user.tenant === 'object' && user.tenant !== null
      ? (user.tenant as { id: string | number }).id
      : (user.tenant as string | number | undefined)
  if (!tenantId) return null

  const tenant = (await getAdminTenant(tenantId)) as unknown as BillingTenantFields

  const state = getTenantBillingState(tenant)
  if (state.kind === 'grandfathered' || state.kind === 'active' || state.kind === 'pending') {
    return null
  }

  const colors: Record<string, { bg: string; fg: string }> = {
    trial: { bg: 'var(--om-warn-bg)', fg: 'var(--om-warn-fg)' },
    past_due_trial: { bg: 'var(--om-err-bg)', fg: 'var(--om-err-fg)' },
    past_due: { bg: 'var(--om-err-bg)', fg: 'var(--om-err-fg)' },
    grace_period: { bg: 'var(--om-err-bg)', fg: 'var(--om-err-fg)' },
    offline: { bg: '#1f2937', fg: '#fff' },
  }
  const c = colors[state.kind]
  const msg =
    state.kind === 'trial'
      ? `Free trial — ${state.daysRemaining} day(s) left.`
      : state.kind === 'past_due_trial'
        ? `Trial ended. Editing is locked until you subscribe.`
        : state.kind === 'past_due'
          ? `Payment failed. Editing is locked until billing is restored.`
          : state.kind === 'grace_period'
            ? `Subscription canceled. Public site goes offline in ${state.daysRemaining} day(s).`
            : `Public site is offline.`

  return (
    <div
      style={{
        background: c.bg,
        color: c.fg,
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: 14,
      }}
    >
      {msg}{' '}
      <a href="/admin/billing" style={{ color: c.fg, textDecoration: 'underline' }}>
        Open billing
      </a>
    </div>
  )
}
