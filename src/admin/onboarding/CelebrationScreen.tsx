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
  return (
    <div className="space-y-8 text-center py-6">
      <div className="space-y-3">
        <p className="text-5xl" aria-hidden>✦</p>
        <h2 className="text-3xl font-semibold text-foreground">Your site is ready.</h2>
        <p className="text-base text-muted-foreground">
          Live at <a className="font-semibold text-primary" href={publicUrl} target="_blank" rel="noopener noreferrer">{publicUrl}</a>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            Visit site <ExternalLink className="size-4" aria-hidden />
          </a>
        </Button>
        <Button variant="secondary" onClick={onDismiss}>Done</Button>
      </div>

      <div className="border-t border-border pt-6 mt-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">What&apos;s next</p>
        <ul className="mt-3 space-y-2 text-base text-foreground">
          <li><a className="text-primary hover:underline" href="/admin/collections/tenants" target="_blank" rel="noopener noreferrer">Connect a custom domain →</a></li>
          <li><a className="text-primary hover:underline" href="/admin/collections/users/create" target="_blank" rel="noopener noreferrer">Invite another admin →</a></li>
          <li><a className="text-primary hover:underline" href="/admin/collections/announcements/create" target="_blank" rel="noopener noreferrer">Share with your jamaa →</a></li>
        </ul>
      </div>
    </div>
  )
}
