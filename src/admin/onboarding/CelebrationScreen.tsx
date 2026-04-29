'use client'

import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

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

  return (
    <div className="px-8 py-10 md:px-12 md:py-14 text-center">
      <div className="space-y-5">
        <p
          aria-hidden
          className="text-2xl"
          style={{ color: 'var(--om-gold, #D9A84E)' }}
        >
          ✦
        </p>
        <h2
          className="text-4xl md:text-5xl text-foreground"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
          }}
        >
          Your site is ready.
        </h2>
        <p className="text-base text-muted-foreground">
          Live at{' '}
          <a
            className="font-semibold text-[var(--brand,#0F1E4A)] underline-offset-4 hover:underline"
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {publicUrl}
          </a>
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          asChild
          className="bg-[var(--brand,#0F1E4A)] text-white hover:bg-[var(--brand,#0F1E4A)]/90"
        >
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            Visit site <ExternalLink className="size-4" aria-hidden />
          </a>
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>

      <div className="mx-auto mt-12 max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            What&apos;s next
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <ul className="space-y-4 text-left">
          {items.map((it) => (
            <li key={it.href}>
              <a
                href={it.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <p
                  className="text-lg text-foreground group-hover:text-[var(--accent,#28A0B4)] transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                  }}
                >
                  {it.title} <span aria-hidden>→</span>
                </p>
                <p className="text-sm text-muted-foreground">{it.desc}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
