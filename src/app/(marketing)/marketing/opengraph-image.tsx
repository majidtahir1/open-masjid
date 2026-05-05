import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'OpenMasjid — A modern website platform built for masajid'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Brand colors mirroring src/app/(marketing)/marketing.css
const CREAM = '#FAF9F4'
const NIGHT = '#0E1B2C' // approximate of --icp-navy-900
const NAVY = '#1B3358' // approximate of --icp-navy-700
const GOLD = '#C9A45A'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: `linear-gradient(135deg, ${CREAM} 0%, #F1ECE0 60%, ${NAVY} 100%)`,
          color: NIGHT,
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: NAVY,
              color: CREAM,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            ◆
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: NIGHT,
              letterSpacing: '-0.01em',
            }}
          >
            OpenMasjid
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontSize: 84,
              lineHeight: 1.05,
              fontWeight: 600,
              color: NIGHT,
              letterSpacing: '-0.02em',
              maxWidth: 1000,
            }}
          >
            A modern website platform built for masajid.
          </div>
          <div
            style={{
              fontSize: 32,
              color: NAVY,
              maxWidth: 900,
              fontStyle: 'italic',
            }}
          >
            Open-source. Secure. Yours to keep.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 24,
            color: NIGHT,
            opacity: 0.85,
          }}
        >
          <span>openmasjid.app</span>
          <span style={{ color: GOLD }}>✦</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
