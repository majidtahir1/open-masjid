'use client'

import { ExternalLink } from 'lucide-react'
import { useState } from 'react'

export function CelebrationScreen({
  publicUrl,
  onDismiss,
}: {
  publicUrl: string
  onDismiss: () => void
}) {
  const items: Array<{ href: string; title: string; desc: string }> = [
    {
      href: '/admin/collections/tenants',
      title: 'Connect a custom domain',
      desc: 'Point yourmasjid.org at your site.',
    },
    {
      href: '/admin/collections/users/create',
      title: 'Invite another admin',
      desc: 'Share the load with your team.',
    },
    {
      href: '/admin/collections/announcements/create',
      title: 'Share with your jamaa',
      desc: 'Post the first announcement.',
    },
  ]

  const [primaryHover, setPrimaryHover] = useState(false)
  const [ghostHover, setGhostHover] = useState(false)

  return (
    <div
      className="text-center"
      style={{
        padding: 'var(--sp-12) var(--sp-12)',
        background: 'var(--bg)',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div className="space-y-5">
        <p
          aria-hidden
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--fs-xl)',
            color: 'var(--icp-gold-500)',
            margin: 0,
          }}
        >
          ✦
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            lineHeight: 1.1,
            color: 'var(--fg1)',
            margin: 0,
          }}
        >
          Your site is ready.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-sm)',
            color: 'var(--fg2)',
            margin: 0,
          }}
        >
          Live at{' '}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontWeight: 600,
              color: 'var(--brand)',
              transition: 'color var(--dur-base) var(--ease-out)',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = 'var(--brand-hover)')
            }
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--brand)')}
          >
            {publicUrl}
          </a>
        </p>
      </div>

      <div
        className="flex flex-wrap items-center justify-center"
        style={{ marginTop: 'var(--sp-8)', gap: 'var(--sp-3)' }}
      >
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setPrimaryHover(true)}
          onMouseLeave={() => setPrimaryHover(false)}
          className="inline-flex items-center"
          style={{
            gap: 'var(--sp-2)',
            background: primaryHover
              ? 'var(--brand-hover)'
              : 'var(--brand)',
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            boxShadow: primaryHover ? 'var(--sh-md)' : 'none',
            transform: primaryHover ? 'translateY(-1px)' : 'translateY(0)',
            transition:
              'background var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
          }}
        >
          Visit site <ExternalLink size={16} aria-hidden />
        </a>
        <button
          type="button"
          onClick={onDismiss}
          onMouseEnter={() => setGhostHover(true)}
          onMouseLeave={() => setGhostHover(false)}
          style={{
            background: ghostHover ? 'var(--icp-gray-100)' : 'transparent',
            color: 'var(--fg1)',
            border: 'none',
            padding: '10px 18px',
            borderRadius: 'var(--r-md)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'background var(--dur-base) var(--ease-out)',
          }}
        >
          Done
        </button>
      </div>

      <div
        className="mx-auto"
        style={{ marginTop: 'var(--sp-12)', maxWidth: 480 }}
      >
        <div
          className="flex items-center"
          style={{ marginBottom: 'var(--sp-5)', gap: 'var(--sp-3)' }}
        >
          <span
            style={{ height: 1, flex: 1, background: 'var(--border)' }}
          />
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--brand)',
            }}
          >
            What&apos;s next
          </span>
          <span
            style={{ height: 1, flex: 1, background: 'var(--border)' }}
          />
        </div>
        <ul className="text-left" style={{ display: 'grid', gap: 'var(--sp-4)', listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map((it) => (
            <li key={it.href}>
              <a
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <p
                  className="group-hover:[color:var(--brand-hover)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 500,
                    fontSize: 'var(--fs-md)',
                    color: 'var(--brand)',
                    margin: 0,
                    transition: 'color var(--dur-base) var(--ease-out)',
                  }}
                >
                  {it.title} <span aria-hidden>→</span>
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--fg2)',
                    margin: 0,
                    marginTop: 'var(--sp-1)',
                  }}
                >
                  {it.desc}
                </p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
