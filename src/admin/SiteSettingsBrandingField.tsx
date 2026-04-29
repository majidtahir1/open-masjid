'use client'

/**
 * SiteSettingsBrandingField
 *
 * Custom Payload group field component for the "branding" group on the Tenants
 * collection. When the current user is a tenant admin editing their own tenant,
 * it renders the polished editorial BrandingStep UI. Platform owners see a
 * plain notice because the /admin/api/onboarding/branding endpoint only saves
 * against the authenticated user's own tenant, not an arbitrary one.
 */

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDocumentInfo, useAuth } from '@payloadcms/ui'
import { BrandingStep, type BrandingInitial } from '@/admin/onboarding/steps/BrandingStep'

type TenantDoc = {
  id: string | number
  name?: string
  slug?: string
  branding?: {
    logo?: { id: string | number; url?: string; filename?: string; filesize?: number } | null
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
    displayFont?: string
  } | null
}

export default function SiteSettingsBrandingField() {
  const router = useRouter()
  const { id: docId } = useDocumentInfo()
  const { user } = useAuth()

  const [tenant, setTenant] = useState<TenantDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Determine if the current user is a platform owner
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

    fetch(`/api/tenants/${docId}?depth=1`, { credentials: 'include' })
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

  /* ---- Platform owner: show a notice instead of the editor ---- */
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
          Branding is managed by the tenant admin.
        </strong>
        Branding is edited by tenant admins via the onboarding wizard or{' '}
        <code
          style={{
            background: 'var(--bg, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: 13,
          }}
        >
          /admin/branding
        </code>
        . To change branding for this tenant, ask the tenant admin or impersonate their account.
      </div>
    )
  }

  /* ---- Loading state ---- */
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
        Loading branding settings…
      </div>
    )
  }

  /* ---- Fetch error ---- */
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

  /* ---- Build BrandingInitial from fetched tenant doc ---- */
  const initial: BrandingInitial = {
    logo: tenant.branding?.logo ?? undefined,
    primaryColor: tenant.branding?.primaryColor,
    secondaryColor: tenant.branding?.secondaryColor,
    accentColor: tenant.branding?.accentColor,
    displayFont: tenant.branding?.displayFont,
  }

  const tenantName = tenant.name ?? 'your masjid'
  const slug = tenant.slug ?? ''
  const publicUrl = slug ? `https://${slug}.openmasjid.app` : 'https://openmasjid.app'

  return (
    <BrandingStep
      initial={initial}
      tenantName={tenantName}
      publicUrl={publicUrl}
      mode="standalone"
      markCompleteOnSave={false}
      onClose={() => router.push('/admin')}
      onSaved={() => router.refresh()}
    />
  )
}
