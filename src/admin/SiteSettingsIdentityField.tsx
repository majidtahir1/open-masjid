'use client'

/**
 * SiteSettingsIdentityField
 *
 * Custom Payload group field component for the "contactInfo" group on the
 * Tenants collection. Renders the editorial IdentityStep UI in place of the
 * auto-generated form. Saves through /admin/api/onboarding/identity, which is
 * scoped to the authenticated user's own tenant — so platform owners get a
 * notice instead.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDocumentInfo, useAuth } from '@payloadcms/ui'
import { IdentityStep, type IdentityInitial } from '@/admin/onboarding/steps/IdentityStep'

const HIDE_DOC_CONTROLS_CSS = `
  body.is-identity-tab .doc-controls,
  body.is-identity-tab .collection-edit__sub-header,
  body.is-identity-tab .doc-header__divider,
  body.is-identity-tab .doc-tabs,
  body.is-identity-tab .doc-tab,
  body.is-identity-tab .doc-tabs__tabs-wrap {
    display: none !important;
  }
`

type TenantDoc = {
  id: string | number
  name?: string | null
  slug?: string | null
  footerTagline?: string | null
  contactInfo?: {
    address?: string | null
    phone?: string | null
    email?: string | null
  } | null
  socialLinks?: Array<{ platform?: string; url?: string }> | null
}

export default function SiteSettingsIdentityField() {
  const router = useRouter()
  const { id: docId } = useDocumentInfo()
  const { user } = useAuth()

  useEffect(() => {
    document.body.classList.add('is-identity-tab')
    return () => {
      document.body.classList.remove('is-identity-tab')
    }
  }, [])

  const [tenant, setTenant] = useState<TenantDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const isPlatformOwner =
    user && (user as { role?: string }).role === 'platformOwner'

  useEffect(() => {
    if (!docId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setFetchError(null)

    fetch(`/api/tenants/${docId}?depth=0`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
        return res.json() as Promise<TenantDoc>
      })
      .then((doc) => {
        if (!cancelled) setTenant(doc)
      })
      .catch((e) => {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : 'Failed to load tenant')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [docId])

  if (isPlatformOwner) {
    return (
      <div
        style={{
          padding: 'var(--sp-6, 24px)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 'var(--r-md, 8px)',
          background: 'var(--bg-alt, #f9fafb)',
          fontFamily: 'var(--font-body, sans-serif)',
          fontSize: 14,
          color: 'var(--fg2, #6b7280)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--fg1, #111827)', display: 'block', marginBottom: 8 }}>
          Identity & Contact is managed by the tenant admin.
        </strong>
        Identity is edited by tenant admins via the onboarding wizard or{' '}
        <code
          style={{
            background: 'var(--bg, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: 13,
          }}
        >
          /admin/identity
        </code>
        . To change identity for this tenant, ask the tenant admin or impersonate their account.
      </div>
    )
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 'var(--sp-6, 24px)',
          color: 'var(--fg3, #9ca3af)',
          fontFamily: 'var(--font-body, sans-serif)',
          fontSize: 14,
        }}
      >
        Loading identity settings…
      </div>
    )
  }

  if (fetchError || !tenant) {
    return (
      <div
        role="alert"
        style={{
          padding: 'var(--sp-4, 16px)',
          border: '1px solid #fecaca',
          borderRadius: 'var(--r-md, 8px)',
          background: '#fef2f2',
          color: '#991b1b',
          fontFamily: 'var(--font-body, sans-serif)',
          fontSize: 13,
        }}
      >
        {fetchError ?? 'Could not load tenant data.'}
      </div>
    )
  }

  const initial: IdentityInitial = {
    name: tenant.name ?? '',
    footerTagline: tenant.footerTagline ?? '',
    contactInfo: {
      address: tenant.contactInfo?.address ?? '',
      phone: tenant.contactInfo?.phone ?? '',
      email: tenant.contactInfo?.email ?? '',
    },
    socialLinks: (tenant.socialLinks ?? [])
      .filter((s): s is { platform: string; url: string } =>
        Boolean(s?.platform && s?.url),
      )
      .map((s) => ({ platform: s.platform, url: s.url })),
  }

  const tenantName = tenant.name ?? 'your masjid'
  const slug = tenant.slug ?? ''
  const publicUrl = slug ? `https://${slug}.openmasjid.app` : 'https://openmasjid.app'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HIDE_DOC_CONTROLS_CSS }} />
      <IdentityStep
        initial={initial}
        tenantName={tenantName}
        publicUrl={publicUrl}
        mode="standalone"
        markCompleteOnSave={false}
        onClose={() => router.push('/admin')}
        onSaved={() => router.refresh()}
      />
    </>
  )
}
