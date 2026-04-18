import React from 'react'

/**
 * Admin panel logo (brand mark in the nav bar).
 *
 * For now this renders the OpenMasjid wordmark in navy. In a later pass,
 * resolve the current tenant at admin time and swap in that tenant's logo
 * (tenant.branding.logo) so each masjid's staff sees their own brand.
 */
const Logo: React.FC = () => {
  // The wordmark uses `--theme-elevation-1000` so it stays readable in both
  // light (dark text on white nav) and dark (light text on near-black nav)
  // admin themes. The pill is always navy+gold — the mark is brand-critical.
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '4px 0',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 6,
          background: '#0F1E4A',
          color: '#F0C88C',
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        ﷻ
      </span>
      <span
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--theme-elevation-1000, #0F1E4A)',
          letterSpacing: '0.01em',
        }}
      >
        OpenMasjid
      </span>
      <span
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 11,
          fontWeight: 500,
          color: '#28A0B4',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginLeft: 4,
        }}
      >
        Admin
      </span>
    </div>
  )
}

export default Logo
