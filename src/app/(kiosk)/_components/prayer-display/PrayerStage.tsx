'use client'

import React, { useLayoutEffect, useState } from 'react'

/**
 * Scales the fixed 1920x1080 prayer-display frame to fit the actual viewport,
 * preserving aspect ratio and centering. Pure CSS can't derive a unitless
 * scale factor from viewport units (`scale(100vw/1920)` is a length, which
 * `transform: scale()` ignores), so we compute it in JS and apply a numeric
 * transform. Children render at design coordinates (1920x1080); layout math
 * elsewhere can rely on that because `transform` does not affect offset sizes.
 */
export default function PrayerStage({
  children,
  zIndex,
}: {
  children: React.ReactNode
  zIndex?: number
}) {
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const compute = () =>
      setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        zIndex,
      }}
    >
      <div
        style={{
          width: 1920,
          height: 1080,
          flex: 'none',
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}
