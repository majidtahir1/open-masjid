'use client'

import type { Hint } from '@/lib/onboardingHints'
import { Lightbulb, ExternalLink } from 'lucide-react'

export function HintRail({ hints }: { hints: Hint[] }) {
  return (
    <aside aria-label="Did you know" className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <Lightbulb className="size-4" aria-hidden /> Did you know?
      </div>
      <ul className="space-y-3">
        {hints.map((h) => (
          <li
            key={h.headline}
            className="rounded-lg border border-border bg-secondary/5 p-4"
          >
            <p className="text-sm font-semibold text-foreground">{h.headline}</p>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{h.body}</p>
            {h.href && (
              <a
                href={h.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Open in admin <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}
