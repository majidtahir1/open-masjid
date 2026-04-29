'use client'

import type { Hint } from '@/lib/onboardingHints'
import { Lightbulb, ExternalLink } from 'lucide-react'

export function HintRail({ hints }: { hints: Hint[] }) {
  return (
    <aside
      aria-label="Did you know"
      style={{
        display: 'grid',
        gap: 'var(--sp-3)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        className="inline-flex items-center"
        style={{
          gap: 'var(--sp-2)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--brand)',
        }}
      >
        <Lightbulb size={16} strokeWidth={2} aria-hidden /> Did you know?
      </div>
      <ul
        style={{
          display: 'grid',
          gap: 'var(--sp-3)',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {hints.map((h) => (
          <li
            key={h.headline}
            style={{
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              background: 'var(--bg-alt)',
              padding: 'var(--sp-4)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 600,
                color: 'var(--fg1)',
                margin: 0,
              }}
            >
              {h.headline}
            </p>
            <p
              style={{
                marginTop: 'var(--sp-1)',
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--fs-sm)',
                lineHeight: 1.55,
                color: 'var(--fg2)',
              }}
            >
              {h.body}
            </p>
            {h.href && (
              <a
                href={h.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center"
                style={{
                  marginTop: 'var(--sp-2)',
                  gap: 'var(--sp-1)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 600,
                  color: 'var(--brand)',
                  transition: 'color var(--dur-base) var(--ease-out)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = 'var(--brand-hover)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = 'var(--brand)')
                }
              >
                Open in admin <ExternalLink size={16} strokeWidth={2} aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}
