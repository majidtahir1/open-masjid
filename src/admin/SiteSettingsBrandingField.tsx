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

/**
 * The BrandingStep saves through its own endpoint (/admin/api/onboarding/branding),
 * so Payload's document-level form never sees changes and the top "Save" / "Last
 * Modified" bar would mislead the user. While this field is mounted, we hide
 * those Payload chrome bits via a body class. The component below renders a
 * <style> tag whose selectors target Payload's standard doc-control classes.
 */
const HIDE_DOC_CONTROLS_CSS = `
  body.is-branding-tab .doc-controls,
  body.is-branding-tab .collection-edit__sub-header,
  body.is-branding-tab .doc-header__divider,
  body.is-branding-tab .doc-tabs,
  body.is-branding-tab .doc-tab,
  body.is-branding-tab .doc-tabs__tabs-wrap {
    display: none !important;
  }
`

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

  // Hide Payload's top-of-page Save bar while this tab is mounted — our
  // BrandingStep has its own "Save changes" button in its sticky footer.
  useEffect(() => {
    document.body.classList.add('is-branding-tab')
    return () => {
      document.body.classList.remove('is-branding-tab')
    }
  }, [])

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
    <>
      <style dangerouslySetInnerHTML={{ __html: HIDE_DOC_CONTROLS_CSS }} />
      <BrandingStep
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
