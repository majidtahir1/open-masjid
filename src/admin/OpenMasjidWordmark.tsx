import React from 'react'

/**
 * Pure presentational OpenMasjid wordmark. Safe to import from both Server
 * and Client components — no `next/headers`, no async, no data fetching.
 * Used as the brand fallback wherever a tenant logo is not available
 * (e.g. Login screen before auth, platformOwner without a tenant).
 */
export default function OpenMasjidWordmark() {
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
