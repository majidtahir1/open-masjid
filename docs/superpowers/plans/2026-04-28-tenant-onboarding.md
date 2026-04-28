# Tenant Onboarding (Option C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a first-login welcome modal + persistent admin banner that walks tenant admins through six setup milestones (Branding, Identity & Contact, Prayer Times, First event, Hero & homepage, Donations), surfaces feature-discovery hints, celebrates completion, and is re-runnable on demand.

**Architecture:**
- **State** lives on the `tenants` collection as an `onboarding` group (per-milestone status: `null | 'complete' | 'dismissed'`, plus a `completedAt` timestamp); a `welcomeSeenAt` field on the `users` collection guards the per-user welcome modal.
- **Completion is auto-detected** from existing tenant data on every dashboard load (logo present, prayer schedule exists, event exists, etc.). The user's explicit `complete` / `dismissed` flags only ever *augment* — they cannot un-complete an already-detected state. This means we don't have to keep state in sync with collection edits.
- **Surface (Option C):** a top-level Welcome dialog rendered on the Payload Dashboard (RSC checks server state, hands off to a client `<OnboardingShell>`), plus a persistent `<OnboardingBanner>` component injected via Payload's `admin.components.beforeNavLinks` slot so it appears on every admin page until done.
- **Mini-wizards** are panels inside the Welcome dialog. Each milestone shows explanation + hints + a primary CTA that opens the corresponding existing admin route in a new tab. The user returns, the dashboard re-detects completion, and the milestone flips. No duplicate forms.
- **Re-run path:** a "Re-run onboarding" action in the collapsed tile and in the user menu calls a tiny endpoint that resets every `dismissed` milestone to `null` (preserves `complete` ones). Tenant data is never touched.

**Tech Stack:**
- Next.js 15 + Payload CMS 3.39 (admin shell)
- React Server Components for the dashboard read; client components for modal/banner
- Existing `shadcn/ui` primitives (`Dialog`, `Button`, `Card`, `Badge`) + Tailwind utility classes
- Vitest for unit tests
- Existing fields/components in `src/admin/*` and `src/fields/*`

---

## File Structure

**New files (created in this plan):**

| Path | Responsibility |
|---|---|
| `src/lib/onboarding.ts` | Pure helper: given a tenant doc + child counts, returns the six milestone states. Edge-safe, no Payload dependencies. |
| `src/lib/onboardingHints.ts` | Static catalog of hint cards, keyed by milestone slug. |
| `src/admin/onboarding/OnboardingShell.tsx` | Client component owning the welcome dialog + tile grid + active-mini-wizard view. |
| `src/admin/onboarding/MilestoneTile.tsx` | Single tile in the 6-card grid. |
| `src/admin/onboarding/MilestonePanel.tsx` | Inner mini-wizard panel for one milestone — explanation, hints, primary CTA, skip/mark-complete actions. |
| `src/admin/onboarding/HintRail.tsx` | Stacked "Did you know?" cards. |
| `src/admin/onboarding/CelebrationScreen.tsx` | "Site is ready" celebratory state. |
| `src/admin/onboarding/OnboardingBanner.tsx` | Thin banner component injected into every admin page when onboarding incomplete. Server component: reads tenant + user, decides whether to render. |
| `src/admin/onboarding/RerunMenuItem.tsx` | "Re-run onboarding" link rendered in `beforeNavLinks` slot for admins who already completed. |
| `src/app/(payload)/admin/api/onboarding/route.ts` | POST endpoint: actions = `mark-complete | skip | reset | seen-welcome`. |
| `src/lib/onboarding.test.ts` | Vitest unit tests for the milestone-detection helper. |

**Modified files:**

| Path | Change |
|---|---|
| `src/collections/Tenants.ts` | Add `onboarding` group: `{ branding, identity, prayer, firstEvent, hero, donations }: select 'complete' \| 'dismissed' \| null`, plus `completedAt: date \| null`. Hidden in admin (managed via API only). |
| `src/collections/Users.ts` | Add `onboardingWelcomeSeenAt: date \| null`, hidden. |
| `src/admin/Dashboard.tsx` | After existing dashboard, render `<OnboardingShell />` (client, hydrates with detected milestone state) when not complete. Show "Setup complete · review →" tile when all done. |
| `src/payload.config.ts` | Register `/src/admin/onboarding/OnboardingBanner#default` in `admin.components.beforeNavLinks` and `/src/admin/onboarding/RerunMenuItem#default` in `admin.components.afterNavLinks`. |

---

## Task 1: Add `onboarding` group field to `tenants`

**Files:**
- Modify: `src/collections/Tenants.ts`
- Modify: `src/payload-types.ts` (auto-regenerated)

- [ ] **Step 1: Add the `onboarding` group field**

In `src/collections/Tenants.ts`, find the `tabs` array. Add a new tab at the end of the existing tabs (after the "Donations" tab) — keep it simple, hidden from non-platform-owners since it's internal state:

```ts
{
  label: 'Onboarding',
  description: 'Internal setup-checklist state. Managed by the welcome wizard.',
  fields: [
    {
      name: 'onboarding',
      type: 'group',
      admin: {
        description:
          'Per-milestone state for the post-login setup wizard. Auto-detected milestones are not stored here; only explicit user actions (skip, mark-complete) are persisted.',
      },
      fields: (
        ['branding', 'identity', 'prayer', 'firstEvent', 'hero', 'donations'] as const
      ).map((slug) => ({
        name: slug,
        type: 'select' as const,
        options: [
          { label: 'Complete', value: 'complete' },
          { label: 'Dismissed', value: 'dismissed' },
        ],
        admin: { description: `Explicit user action for the ${slug} milestone.` },
      })),
    },
    {
      name: 'onboardingCompletedAt',
      type: 'date',
      admin: {
        description: 'Set when the user dismisses the celebratory screen.',
      },
    },
  ],
},
```

- [ ] **Step 2: Regenerate Payload types**

Run:
```bash
npx payload generate:types
```
Expected: `src/payload-types.ts` updates with `Tenant.onboarding` and `Tenant.onboardingCompletedAt` properties.

- [ ] **Step 3: Verify schema in dev**

Start the dev server. When the schema-push prompt appears (Postgres `tenants_onboarding` group becomes JSON columns), accept with `y`. Verify no other unintended schema changes.

```bash
PAYLOAD_FORCE_PUSH=true npm run dev
```
(Cancel after schema push completes.)

- [ ] **Step 4: Commit**

```bash
git add src/collections/Tenants.ts src/payload-types.ts
git commit -m "feat(tenants): add onboarding state group field"
```

---

## Task 2: Add `onboardingWelcomeSeenAt` field to `users`

**Files:**
- Modify: `src/collections/Users.ts`

- [ ] **Step 1: Add the field**

Find the `fields` array in `Users.ts`. Append:

```ts
{
  name: 'onboardingWelcomeSeenAt',
  type: 'date',
  admin: {
    description:
      'Set the first time this user sees the onboarding welcome dialog. Used to suppress re-showing it on subsequent logins.',
    readOnly: true,
    hidden: true,
  },
},
```

- [ ] **Step 2: Regenerate types & accept push**

```bash
npx payload generate:types
PAYLOAD_FORCE_PUSH=true npm run dev
```

- [ ] **Step 3: Commit**

```bash
git add src/collections/Users.ts src/payload-types.ts
git commit -m "feat(users): add onboardingWelcomeSeenAt field"
```

---

## Task 3: Build the milestone-detection helper

**Files:**
- Create: `src/lib/onboarding.ts`
- Create: `src/lib/onboarding.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/onboarding.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeMilestoneStates, MILESTONES, type OnboardingInput } from './onboarding'

const empty: OnboardingInput = {
  tenant: {
    branding: { logo: null },
    contactInfo: { address: null },
    donationConfig: { mode: null },
    onboarding: null,
  },
  counts: { prayerSchedules: 0, events: 0, heroSlides: 0 },
}

describe('computeMilestoneStates', () => {
  it('returns six milestones in fixed order', () => {
    const states = computeMilestoneStates(empty)
    expect(states.map((s) => s.slug)).toEqual([
      'branding',
      'identity',
      'prayer',
      'firstEvent',
      'hero',
      'donations',
    ])
  })

  it('detects branding complete when logo is set', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, branding: { logo: 'media-id-1' } },
    })
    expect(states.find((s) => s.slug === 'branding')?.status).toBe('complete')
  })

  it('detects identity complete when address is set', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, contactInfo: { address: '123 Main St, Plano TX' } },
    })
    expect(states.find((s) => s.slug === 'identity')?.status).toBe('complete')
  })

  it('detects prayer complete when at least one schedule exists', () => {
    const states = computeMilestoneStates({
      ...empty,
      counts: { ...empty.counts, prayerSchedules: 1 },
    })
    expect(states.find((s) => s.slug === 'prayer')?.status).toBe('complete')
  })

  it('detects firstEvent complete when at least one event exists', () => {
    const states = computeMilestoneStates({
      ...empty,
      counts: { ...empty.counts, events: 1 },
    })
    expect(states.find((s) => s.slug === 'firstEvent')?.status).toBe('complete')
  })

  it('detects hero complete when at least one hero slide exists', () => {
    const states = computeMilestoneStates({
      ...empty,
      counts: { ...empty.counts, heroSlides: 1 },
    })
    expect(states.find((s) => s.slug === 'hero')?.status).toBe('complete')
  })

  it('detects donations complete when mode is any non-null value', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, donationConfig: { mode: 'hidden' } },
    })
    expect(states.find((s) => s.slug === 'donations')?.status).toBe('complete')
  })

  it('returns dismissed when explicitly dismissed and not auto-detected', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: { ...empty.tenant, onboarding: { branding: 'dismissed' } },
    })
    expect(states.find((s) => s.slug === 'branding')?.status).toBe('dismissed')
  })

  it('auto-detected complete trumps explicit dismissed', () => {
    const states = computeMilestoneStates({
      ...empty,
      tenant: {
        ...empty.tenant,
        branding: { logo: 'm1' },
        onboarding: { branding: 'dismissed' },
      },
    })
    expect(states.find((s) => s.slug === 'branding')?.status).toBe('complete')
  })

  it('returns not-started by default', () => {
    const states = computeMilestoneStates(empty)
    expect(states.every((s) => s.status === null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/onboarding.test.ts
```
Expected: FAIL — `Cannot find module './onboarding'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/onboarding.ts`:

```ts
/**
 * Pure milestone-state computation for tenant onboarding.
 *
 * Auto-detected completion always wins over an explicit `dismissed` flag —
 * so when an admin actually does the work of adding a logo / event / etc.
 * after dismissing, the milestone correctly flips to `complete`.
 *
 * Edge-safe: zero runtime dependencies. Importable from RSC, client, or
 * the API endpoint without pulling Payload.
 */

export const MILESTONES = [
  'branding',
  'identity',
  'prayer',
  'firstEvent',
  'hero',
  'donations',
] as const

export type MilestoneSlug = (typeof MILESTONES)[number]

export type MilestoneStatus = 'complete' | 'dismissed' | null

export type MilestoneState = {
  slug: MilestoneSlug
  status: MilestoneStatus
}

export type OnboardingInput = {
  tenant: {
    branding?: { logo?: unknown } | null
    contactInfo?: { address?: string | null } | null
    donationConfig?: { mode?: string | null } | null
    onboarding?: Partial<Record<MilestoneSlug, MilestoneStatus>> | null
  }
  counts: {
    prayerSchedules: number
    events: number
    heroSlides: number
  }
}

function isAutoComplete(slug: MilestoneSlug, input: OnboardingInput): boolean {
  const t = input.tenant
  switch (slug) {
    case 'branding':
      return Boolean(t.branding?.logo)
    case 'identity':
      return Boolean(t.contactInfo?.address?.trim())
    case 'prayer':
      return input.counts.prayerSchedules > 0
    case 'firstEvent':
      return input.counts.events > 0
    case 'hero':
      return input.counts.heroSlides > 0
    case 'donations':
      return Boolean(t.donationConfig?.mode)
  }
}

export function computeMilestoneStates(input: OnboardingInput): MilestoneState[] {
  const explicit = input.tenant.onboarding ?? {}
  return MILESTONES.map((slug) => {
    if (isAutoComplete(slug, input)) {
      return { slug, status: 'complete' as const }
    }
    return { slug, status: (explicit[slug] ?? null) as MilestoneStatus }
  })
}

export function isAllDoneOrDismissed(states: MilestoneState[]): boolean {
  return states.every((s) => s.status === 'complete' || s.status === 'dismissed')
}

export function completedCount(states: MilestoneState[]): number {
  return states.filter((s) => s.status === 'complete').length
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/onboarding.test.ts
```
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding.ts src/lib/onboarding.test.ts
git commit -m "feat(onboarding): add milestone-state detection helper"
```

---

## Task 4: Build the hint catalog

**Files:**
- Create: `src/lib/onboardingHints.ts`

- [ ] **Step 1: Write the catalog**

```ts
import type { MilestoneSlug } from './onboarding'

export type Hint = {
  headline: string
  body: string
  /** Admin path the link opens. Always opens in a new tab. */
  href?: string
}

export const HINTS: Record<MilestoneSlug, Hint[]> = {
  branding: [
    {
      headline: 'Live preview is one click away.',
      body: 'Open your public site in a new tab — color edits reflect in real time.',
    },
    {
      headline: 'SVG logos resize cleanly.',
      body: "Upload an SVG and we'll size it for every screen automatically.",
    },
    {
      headline: 'Three colors do all the work.',
      body: 'Pick brand, secondary, and accent — we derive the full palette.',
    },
    {
      headline: 'Custom font?',
      body: 'Paste any Google Fonts URL in the advanced section.',
    },
  ],
  identity: [
    {
      headline: 'Address auto-fills your map and timezone.',
      body: 'Type a real address and we geocode it for prayer times and the contact map.',
    },
    {
      headline: 'Empty socials are hidden.',
      body: 'Add only the platforms your jamaa actually uses — blanks never render.',
    },
    {
      headline: 'Footer tagline shows on every page.',
      body: "It's the line above the legal text. Keep it short and warm.",
    },
  ],
  prayer: [
    {
      headline: 'Three ways to keep them current.',
      body: 'Aladhan auto-update, CSV bulk import, or manual entry. Mix them however you like.',
    },
    {
      headline: 'Iqamah overrides per day.',
      body: 'Tweak any single day without rewriting the rest of the schedule.',
    },
    {
      headline: 'Multiple jummah slots are first-class.',
      body: "Add as many khutbas as you need — the public site shows them all.",
    },
  ],
  firstEvent: [
    {
      headline: 'Recurring events: write them naturally.',
      body: '"Mondays after Isha" is a real, supported value. So is "First Saturday."',
    },
    {
      headline: 'Three flyer modes.',
      body: 'Upload your own, auto-generate one in your colors, or skip the flyer entirely.',
    },
    {
      headline: 'Audience tags.',
      body: 'Tag for sisters, brothers, youth, families. Visitors filter themselves.',
    },
    {
      headline: 'Schedule events to publish later.',
      body: "Save as draft, set a publish date, walk away.",
    },
  ],
  hero: [
    {
      headline: 'Featured events become hero slides.',
      body: 'Mark an event as featured and it auto-appears in the homepage rotation.',
    },
    {
      headline: 'PhotoTone keeps text readable.',
      body: 'We sample your image to pick a tone, so headlines stay legible no matter the photo.',
    },
    {
      headline: 'Drag to reorder.',
      body: 'Slides reorder live in the admin — no save needed between drags.',
    },
  ],
  donations: [
    {
      headline: "Stripe charges Stripe's fee. We don't take a cut.",
      body: '2.9% + 30¢ in the US. The rest goes to your masjid.',
    },
    {
      headline: 'Sadaqah, Zakat, Building Fund.',
      body: "Donors pick a category at checkout — you get a real report by category.",
    },
    {
      headline: 'Already on LaunchGood?',
      body: 'Just paste the URL. The donate button links straight there.',
    },
  ],
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/onboardingHints.ts
git commit -m "feat(onboarding): add hint catalog"
```

---

## Task 5: Build the API endpoint for onboarding actions

**Files:**
- Create: `src/app/(payload)/admin/api/onboarding/route.ts`

- [ ] **Step 1: Write the endpoint**

```ts
import { NextResponse } from 'next/server'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { MILESTONES, type MilestoneSlug } from '@/lib/onboarding'

type Action =
  | { type: 'mark-complete'; slug: MilestoneSlug }
  | { type: 'skip'; slug: MilestoneSlug }
  | { type: 'reset' }
  | { type: 'seen-welcome' }
  | { type: 'celebrate-dismissed' }

function tenantIdOf(t: unknown): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && t !== null && 'id' in t) {
    return (t as { id: string | number }).id
  }
  return t as string | number
}

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  if (user.role === 'platformOwner') {
    return NextResponse.json({ error: 'platform-owners do not onboard' }, { status: 403 })
  }
  const tenantId = tenantIdOf((user as { tenant?: unknown }).tenant)
  if (!tenantId) return NextResponse.json({ error: 'no-tenant' }, { status: 400 })

  const action = (await req.json()) as Action

  if (action.type === 'seen-welcome') {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { onboardingWelcomeSeenAt: new Date().toISOString() },
      overrideAccess: true,
    })
    return NextResponse.json({ ok: true })
  }

  // Read current onboarding state
  const tenant = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as { onboarding?: Record<string, string | null> | null }
  const current = tenant.onboarding ?? {}

  let next: Record<string, string | null> = { ...current }
  let completedAt: string | null | undefined = undefined

  if (action.type === 'mark-complete') {
    if (!MILESTONES.includes(action.slug)) {
      return NextResponse.json({ error: 'bad-slug' }, { status: 400 })
    }
    next[action.slug] = 'complete'
  } else if (action.type === 'skip') {
    if (!MILESTONES.includes(action.slug)) {
      return NextResponse.json({ error: 'bad-slug' }, { status: 400 })
    }
    next[action.slug] = 'dismissed'
  } else if (action.type === 'reset') {
    // Reset all `dismissed` to null. Keep `complete` as-is.
    next = Object.fromEntries(
      MILESTONES.map((slug) => [slug, current[slug] === 'complete' ? 'complete' : null]),
    )
    completedAt = null
  } else if (action.type === 'celebrate-dismissed') {
    completedAt = new Date().toISOString()
  } else {
    return NextResponse.json({ error: 'unknown-action' }, { status: 400 })
  }

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      onboarding: next,
      ...(completedAt !== undefined ? { onboardingCompletedAt: completedAt } : {}),
    },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Smoke-test the endpoint**

Start dev (`npm run dev`). With an admin logged in, run in browser devtools:
```js
await fetch('/admin/api/onboarding', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 'skip', slug: 'donations' }),
}).then(r => r.json())
```
Expected: `{ ok: true }`. Verify in Payload admin that `tenants > Onboarding > donations = Dismissed`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(payload\)/admin/api/onboarding/route.ts
git commit -m "feat(onboarding): add api endpoint for milestone actions"
```

---

## Task 6: Build the HintRail component

**Files:**
- Create: `src/admin/onboarding/HintRail.tsx`

- [ ] **Step 1: Write the component**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/onboarding/HintRail.tsx
git commit -m "feat(onboarding): add HintRail component"
```

---

## Task 7: Build the MilestoneTile component

**Files:**
- Create: `src/admin/onboarding/MilestoneTile.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import type { MilestoneSlug, MilestoneStatus } from '@/lib/onboarding'
import { Check, ChevronRight, MinusCircle } from 'lucide-react'

const TITLES: Record<MilestoneSlug, { title: string; subtitle: string }> = {
  branding: { title: 'Branding', subtitle: 'Logo, colors, and font' },
  identity: { title: 'Identity & Contact', subtitle: 'Name, address, socials' },
  prayer: { title: 'Prayer Times', subtitle: 'Schedule and method' },
  firstEvent: { title: 'Your first event', subtitle: 'Sample Jummah ready to edit' },
  hero: { title: 'Hero & homepage', subtitle: 'What visitors see first' },
  donations: { title: 'Donations', subtitle: 'Stripe, link out, or hide' },
}

export function MilestoneTile({
  slug,
  status,
  onOpen,
}: {
  slug: MilestoneSlug
  status: MilestoneStatus
  onOpen: () => void
}) {
  const meta = TITLES[slug]
  const cta =
    status === 'complete' ? 'Review' : status === 'dismissed' ? 'Open anyway' : 'Start'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-start gap-4 rounded-xl border border-border bg-white p-5 text-left transition-all hover:border-primary hover:shadow-md"
    >
      <span
        aria-hidden
        className={`grid size-9 shrink-0 place-items-center rounded-full text-white ${
          status === 'complete'
            ? 'bg-green-600'
            : status === 'dismissed'
              ? 'bg-muted text-muted-foreground'
              : 'bg-secondary'
        }`}
      >
        {status === 'complete' ? (
          <Check className="size-5" />
        ) : status === 'dismissed' ? (
          <MinusCircle className="size-5" />
        ) : (
          <span className="text-sm font-bold">·</span>
        )}
      </span>
      <span className="flex-1 space-y-1">
        <span className="block text-base font-semibold text-foreground">{meta.title}</span>
        <span className="block text-sm text-muted-foreground">{meta.subtitle}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary group-hover:underline">
        {cta} <ChevronRight className="size-4" aria-hidden />
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/onboarding/MilestoneTile.tsx
git commit -m "feat(onboarding): add MilestoneTile component"
```

---

## Task 8: Build the MilestonePanel (mini-wizard view)

**Files:**
- Create: `src/admin/onboarding/MilestonePanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useState } from 'react'
import type { MilestoneSlug, MilestoneStatus } from '@/lib/onboarding'
import { HINTS } from '@/lib/onboardingHints'
import { HintRail } from './HintRail'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink } from 'lucide-react'

type PanelMeta = {
  title: string
  intro: string
  primaryHref: string
  primaryLabel: string
}

const PANELS: Record<MilestoneSlug, PanelMeta> = {
  branding: {
    title: 'Make it look like your masjid',
    intro:
      'Upload a logo, pick three colors, and choose a display font. The rest of the palette derives automatically.',
    primaryHref: '/admin/collections/tenants',
    primaryLabel: 'Open branding settings',
  },
  identity: {
    title: 'Tell visitors who you are',
    intro:
      'Add your masjid name, address (we geocode it for you), phone, public email, and the socials you actually use.',
    primaryHref: '/admin/collections/tenants',
    primaryLabel: 'Open identity settings',
  },
  prayer: {
    title: 'Add your prayer schedule',
    intro:
      "Pick a calculation method and add at least one schedule. We'll keep it on the homepage strip and the prayer times page.",
    primaryHref: '/admin/collections/prayer-schedules/create',
    primaryLabel: 'Open the schedule editor',
  },
  firstEvent: {
    title: 'Your first event is ready to edit',
    intro:
      "We've prefilled a sample Jummah event. Edit it, save it, or skip and add your own later.",
    primaryHref: '/admin/collections/events/create',
    primaryLabel: 'Open the event editor',
  },
  hero: {
    title: 'Set your homepage hero',
    intro:
      "Featured events become hero slides automatically — or you can upload a photo. Skip if you'd rather use the default.",
    primaryHref: '/admin/collections/hero-slides/create',
    primaryLabel: 'Open the hero editor',
  },
  donations: {
    title: 'Set up donations',
    intro:
      'Native Stripe (with Sadaqah / Zakat / Building Fund tabs), an external link, or hide the donate button entirely. Your call.',
    primaryHref: '/admin/collections/tenants',
    primaryLabel: 'Open donation settings',
  },
}

async function postAction(action: object): Promise<void> {
  await fetch('/admin/api/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action),
  })
}

export function MilestonePanel({
  slug,
  status,
  onBack,
  onChanged,
}: {
  slug: MilestoneSlug
  status: MilestoneStatus
  onBack: () => void
  onChanged: () => void
}) {
  const meta = PANELS[slug]
  const [busy, setBusy] = useState(false)

  const act = async (action: object) => {
    setBusy(true)
    try {
      await postAction(action)
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to checklist
        </button>
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{meta.title}</h2>
          <p className="mt-2 text-base text-muted-foreground leading-relaxed">{meta.intro}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <a href={meta.primaryHref} target="_blank" rel="noopener noreferrer">
              {meta.primaryLabel}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </Button>
          {status !== 'complete' && (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act({ type: 'mark-complete', slug })}
            >
              Mark complete
            </Button>
          )}
          {status !== 'dismissed' && status !== 'complete' && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => act({ type: 'skip', slug })}
            >
              Skip for now
            </Button>
          )}
        </div>
      </div>

      <HintRail hints={HINTS[slug]} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/onboarding/MilestonePanel.tsx
git commit -m "feat(onboarding): add MilestonePanel mini-wizard component"
```

---

## Task 9: Build the CelebrationScreen component

**Files:**
- Create: `src/admin/onboarding/CelebrationScreen.tsx`

- [ ] **Step 1: Write the component**

```tsx
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
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">What's next</p>
        <ul className="mt-3 space-y-2 text-base text-foreground">
          <li><a className="text-primary hover:underline" href="/admin/collections/tenants" target="_blank" rel="noopener noreferrer">Connect a custom domain →</a></li>
          <li><a className="text-primary hover:underline" href="/admin/collections/users/create" target="_blank" rel="noopener noreferrer">Invite another admin →</a></li>
          <li><a className="text-primary hover:underline" href="/admin/collections/announcements/create" target="_blank" rel="noopener noreferrer">Share with your jamaa →</a></li>
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/onboarding/CelebrationScreen.tsx
git commit -m "feat(onboarding): add CelebrationScreen component"
```

---

## Task 10: Build the OnboardingShell client orchestrator

**Files:**
- Create: `src/admin/onboarding/OnboardingShell.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  type MilestoneSlug,
  type MilestoneState,
  isAllDoneOrDismissed,
  completedCount,
} from '@/lib/onboarding'
import { MilestoneTile } from './MilestoneTile'
import { MilestonePanel } from './MilestonePanel'
import { CelebrationScreen } from './CelebrationScreen'

type Props = {
  initialStates: MilestoneState[]
  publicUrl: string
  /** True iff this user has never seen the welcome modal yet. */
  showWelcome: boolean
  /** True iff onboardingCompletedAt is set on the tenant — celebratory was already dismissed. */
  alreadyCelebrated: boolean
}

async function postAction(action: object): Promise<void> {
  await fetch('/admin/api/onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(action),
  })
}

export function OnboardingShell({
  initialStates,
  publicUrl,
  showWelcome,
  alreadyCelebrated,
}: Props) {
  const [open, setOpen] = useState(showWelcome)
  const [states, setStates] = useState(initialStates)
  const [activeSlug, setActiveSlug] = useState<MilestoneSlug | null>(null)
  const [showCelebration, setShowCelebration] = useState(
    !alreadyCelebrated && isAllDoneOrDismissed(initialStates),
  )

  // Mark the welcome modal "seen" the first time we open it.
  useEffect(() => {
    if (showWelcome) {
      void postAction({ type: 'seen-welcome' })
    }
  }, [showWelcome])

  const refresh = async () => {
    // Refetch the dashboard server data via a router refresh.
    // Easiest path: full page reload of admin index — keeps the RSC source of truth.
    window.location.reload()
  }

  const done = completedCount(states)

  return (
    <>
      {/* Re-open trigger — the dashboard tile renders this when modal closed */}
      <div className="rounded-xl border border-border bg-white p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-foreground">
            {showCelebration || isAllDoneOrDismissed(states)
              ? 'Setup complete'
              : `Setup checklist · ${done} of 6 done`}
          </p>
          <p className="text-sm text-muted-foreground">
            {showCelebration || isAllDoneOrDismissed(states)
              ? 'Re-run the wizard any time to revisit the steps.'
              : 'Pick up where you left off.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {isAllDoneOrDismissed(states) ? 'Re-run onboarding' : 'Continue setup'}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {showCelebration ? (
            <CelebrationScreen
              publicUrl={publicUrl}
              onDismiss={async () => {
                await postAction({ type: 'celebrate-dismissed' })
                setShowCelebration(false)
                setOpen(false)
              }}
            />
          ) : activeSlug ? (
            <MilestonePanel
              slug={activeSlug}
              status={states.find((s) => s.slug === activeSlug)?.status ?? null}
              onBack={() => setActiveSlug(null)}
              onChanged={refresh}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Welcome to OpenMasjid.</DialogTitle>
                <DialogDescription className="text-base">
                  Your site is already live with our defaults. Let's make it look like your masjid.
                </DialogDescription>
              </DialogHeader>
              <ul className="grid gap-3 mt-4">
                {states.map((s) => (
                  <li key={s.slug}>
                    <MilestoneTile
                      slug={s.slug}
                      status={s.status}
                      onOpen={() => setActiveSlug(s.slug)}
                    />
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center pt-4 mt-2 border-t border-border">
                <button
                  type="button"
                  onClick={async () => {
                    await postAction({ type: 'reset' })
                    void refresh()
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Reset checklist
                </button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Take me to the admin
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/admin/onboarding/OnboardingShell.tsx
git commit -m "feat(onboarding): add OnboardingShell orchestrator"
```

---

## Task 11: Wire the Dashboard to render OnboardingShell

**Files:**
- Modify: `src/admin/Dashboard.tsx`

- [ ] **Step 1: Add the shell to TenantDashboard**

In `src/admin/Dashboard.tsx`, near the top of the file add:

```ts
import { OnboardingShell } from './onboarding/OnboardingShell'
import { computeMilestoneStates } from '@/lib/onboarding'
```

Then update `TenantDashboard` so that immediately after fetching `[schedule, eventsRes, announcementsRes]`, it also fetches the data needed for onboarding:

```ts
const [tenantDoc, prayerSchedulesCount, heroSlidesCount] = await Promise.all([
  payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  }) as Promise<unknown as Record<string, unknown>>,
  payload
    .find({
      collection: 'prayer-schedules' as never,
      where: { tenant: { equals: tenantId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    .then((r) => r.totalDocs)
    .catch(() => 0),
  payload
    .find({
      collection: 'hero-slides',
      where: { tenant: { equals: tenantId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    .then((r) => r.totalDocs)
    .catch(() => 0),
])

const onboardingStates = computeMilestoneStates({
  tenant: {
    branding: (tenantDoc as { branding?: { logo?: unknown } }).branding ?? null,
    contactInfo: (tenantDoc as { contactInfo?: { address?: string | null } }).contactInfo ?? null,
    donationConfig:
      (tenantDoc as { donationConfig?: { mode?: string | null } }).donationConfig ?? null,
    onboarding:
      ((tenantDoc as { onboarding?: Record<string, string | null> }).onboarding as
        | Partial<Record<import('@/lib/onboarding').MilestoneSlug, import('@/lib/onboarding').MilestoneStatus>>
        | null) ?? null,
  },
  counts: {
    prayerSchedules: prayerSchedulesCount,
    events: eventsRes.totalDocs,
    heroSlides: heroSlidesCount,
  },
})
const showWelcome = !user.onboardingWelcomeSeenAt
const alreadyCelebrated = Boolean(
  (tenantDoc as { onboardingCompletedAt?: string | null }).onboardingCompletedAt,
)

const tenantSlug = (tenantDoc as { slug?: string }).slug ?? ''
const publicUrl = `https://${tenantSlug}.openmasjid.app`
```

Add the `<OnboardingShell>` to the JSX of `TenantDashboard`, immediately above the existing `<header>`:

```tsx
<OnboardingShell
  initialStates={onboardingStates}
  publicUrl={publicUrl}
  showWelcome={showWelcome}
  alreadyCelebrated={alreadyCelebrated}
/>
```

(Note: `eventsRes.totalDocs` already exists from the parallel fetch; do not refetch.)

Also extend the `UserLite` type in this file to include `onboardingWelcomeSeenAt?: string | null`.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 3: Smoke-test in the browser**

```bash
npm run dev
```
Sign in as a tenant admin who has never seen onboarding (clear `onboardingWelcomeSeenAt` in admin if needed). Expected: welcome modal opens automatically; clicking a tile shows the panel; clicking "Re-run onboarding" works after clearing all milestones.

- [ ] **Step 4: Commit**

```bash
git add src/admin/Dashboard.tsx
git commit -m "feat(onboarding): wire Dashboard to render OnboardingShell"
```

---

## Task 12: Build the persistent OnboardingBanner

**Files:**
- Create: `src/admin/onboarding/OnboardingBanner.tsx`

- [ ] **Step 1: Write the server component**

```tsx
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'
import { computeMilestoneStates, isAllDoneOrDismissed, completedCount } from '@/lib/onboarding'

function tenantIdOf(t: unknown): string | number | null {
  if (!t) return null
  if (typeof t === 'object' && t !== null && 'id' in t) return (t as { id: string | number }).id
  return t as string | number
}

export default async function OnboardingBanner() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user || user.role === 'platformOwner') return null
  const tenantId = tenantIdOf((user as { tenant?: unknown }).tenant)
  if (!tenantId) return null

  const tenantDoc = (await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    depth: 0,
    overrideAccess: true,
  })) as unknown as Record<string, unknown>

  // Skip the banner once the user has dismissed the celebratory screen.
  if (tenantDoc.onboardingCompletedAt) return null

  const [prayerCount, eventsCount, heroCount] = await Promise.all([
    payload
      .find({
        collection: 'prayer-schedules' as never,
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      .then((r) => r.totalDocs)
      .catch(() => 0),
    payload
      .find({
        collection: 'events',
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      .then((r) => r.totalDocs),
    payload
      .find({
        collection: 'hero-slides',
        where: { tenant: { equals: tenantId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
      })
      .then((r) => r.totalDocs)
      .catch(() => 0),
  ])

  const states = computeMilestoneStates({
    tenant: {
      branding: tenantDoc.branding as { logo?: unknown } | null,
      contactInfo: tenantDoc.contactInfo as { address?: string | null } | null,
      donationConfig: tenantDoc.donationConfig as { mode?: string | null } | null,
      onboarding:
        (tenantDoc.onboarding as Partial<
          Record<import('@/lib/onboarding').MilestoneSlug, import('@/lib/onboarding').MilestoneStatus>
        > | null) ?? null,
    },
    counts: { prayerSchedules: prayerCount, events: eventsCount, heroSlides: heroCount },
  })

  if (isAllDoneOrDismissed(states)) return null

  const done = completedCount(states)

  return (
    <div className="bg-secondary/15 border-b border-border px-4 py-2 text-sm flex items-center gap-3">
      <span className="font-semibold text-foreground">
        Setup checklist — {done} of 6 done
      </span>
      <Link href="/admin" className="text-primary hover:underline font-semibold">
        Resume →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Register in payload.config.ts**

In `src/payload.config.ts`, modify `admin.components.beforeNavLinks` to prepend the banner:

```ts
beforeNavLinks: [
  '/src/admin/onboarding/OnboardingBanner#default',
  '/src/admin/DashboardLink#default',
  '/src/admin/SiteSettingsLink#default',
],
```

- [ ] **Step 3: Smoke-test**

Restart dev. Visit any non-dashboard admin page (e.g. `/admin/collections/events`). Expected: banner shows "Setup checklist — N of 6 done · Resume →". Clicking Resume navigates to `/admin`.

- [ ] **Step 4: Commit**

```bash
git add src/admin/onboarding/OnboardingBanner.tsx src/payload.config.ts
git commit -m "feat(onboarding): add persistent OnboardingBanner across admin"
```

---

## Task 13: Add the Re-run menu item

**Files:**
- Create: `src/admin/onboarding/RerunMenuItem.tsx`

- [ ] **Step 1: Write the client component**

```tsx
'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'

export default function RerunMenuItem() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <RefreshCw className="size-4" aria-hidden /> Re-run onboarding
    </Link>
  )
}
```

- [ ] **Step 2: Register in payload.config.ts**

```ts
afterNavLinks: [
  '/src/admin/ViewPublicSiteLink#default',
  '/src/admin/onboarding/RerunMenuItem#default',
],
```

- [ ] **Step 3: Smoke-test**

The link is visible in the admin nav for all roles. Clicking takes you to `/admin`, where the dashboard tile's "Re-run onboarding" button can fire `reset`.

- [ ] **Step 4: Commit**

```bash
git add src/admin/onboarding/RerunMenuItem.tsx src/payload.config.ts
git commit -m "feat(onboarding): add re-run nav link"
```

---

## Task 14: Hide onboarding UI for platform owners

**Files:**
- Modify: `src/admin/onboarding/RerunMenuItem.tsx` (gate by role)
- Verify: `src/admin/onboarding/OnboardingBanner.tsx` already returns null for platformOwner

- [ ] **Step 1: Convert RerunMenuItem to a server component**

Replace its body with:

```tsx
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { RefreshCw } from 'lucide-react'

export default async function RerunMenuItem() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user || user.role === 'platformOwner') return null
  return (
    <Link
      href="/admin"
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <RefreshCw className="size-4" aria-hidden /> Re-run onboarding
    </Link>
  )
}
```

- [ ] **Step 2: Smoke-test as platformOwner**

Sign in as platformOwner. Expected: no banner, no re-run link, no welcome modal. Sign in as tenant admin: all three appear.

- [ ] **Step 3: Commit**

```bash
git add src/admin/onboarding/RerunMenuItem.tsx
git commit -m "feat(onboarding): hide re-run link from platform owners"
```

---

## Task 15: End-to-end smoke pass

**Files:** none (verification only)

- [ ] **Step 1: Reset state for a fresh test**

In the Payload admin (as platform owner), open a tenant. Set `Onboarding > all milestones` to blank, set `onboardingCompletedAt` to blank. In the user's profile, clear `onboardingWelcomeSeenAt`.

- [ ] **Step 2: Sign in as tenant admin**

Expected:
- Welcome modal opens automatically.
- Tile grid shows six milestones, all "Start".
- Clicking "Branding" opens the panel with hint rail.
- Clicking "Open branding settings" opens `/admin/collections/tenants` in a new tab.
- After uploading a logo and returning to `/admin`, the Branding tile flips to "complete" automatically (auto-detection).
- Clicking "Skip for now" on Identity flips it to "dismissed" with "Open anyway" CTA.
- Clicking "Mark complete" on Donations flips it to complete without leaving the modal.

- [ ] **Step 3: Trigger celebratory screen**

Mark all six complete or dismissed. Reload `/admin`. Expected: celebratory screen renders inside the dialog. Click "Done" → dialog closes, banner disappears, dashboard tile collapses to "Setup complete".

- [ ] **Step 4: Re-run flow**

Click "Re-run onboarding" in the user nav. Expected: dashboard tile shows "Continue setup" with the dismissed milestones reset to "Start"; complete milestones stay complete; banner reappears if anything is incomplete.

- [ ] **Step 5: Build verification**

```bash
npm run build
```
Expected: no type errors, clean build.

- [ ] **Step 6: Commit any final fixes**

If the smoke pass surfaced bugs, fix them in this commit:
```bash
git commit -am "fix(onboarding): smoke-pass corrections"
```

---

## Self-review checklist (run after writing the plan)

1. **Spec coverage:**
   - §2 trigger model → Tasks 1, 2, 5, 10, 11 (welcomeSeenAt + initial dialog)
   - §3 six milestones → Tasks 3, 8 (panel meta covers all six slugs)
   - §4.1 hint rail → Tasks 4, 6
   - §4.3 completion behavior → Task 3 (auto-detect + explicit augment)
   - §4.5 exit affordance → Task 10 ("Take me to the admin" button)
   - §5 Option C surface → Tasks 10, 12
   - §5 re-run path → Tasks 5 (`reset`), 10 (button), 13 (nav link)
   - §6.2 fresh-tenant defaults → handled by existing tenant collection defaults; not in this plan's scope.
   - §6.3 celebratory dismiss persistence → Task 5 (`celebrate-dismissed` + `onboardingCompletedAt`)
   - §6.4 platformOwner exclusion → Tasks 12, 14

2. **No placeholders.** Every code step has actual code.

3. **Type consistency.** `MilestoneSlug`, `MilestoneStatus`, `MilestoneState`, `OnboardingInput` are defined in Task 3 and used consistently in Tasks 5, 7, 8, 10, 11, 12.

4. **Out-of-scope items not implemented:** custom-domain step, invite-admin step, WordPress migration, analytics events, localization — confirmed.
