# Tenant Form Builder v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development to dispatch implementers per phase.

**Goal:** Layer four v2 enhancements onto the v1 form builder shipped in PR #67. Spec: `docs/superpowers/specs/2026-05-06-tenant-form-builder-v2-design.md`.

**Architecture:** (1) move public-form route from `(site)` to a new standalone `(forms)` route group with its own minimal layout; (2) add an `appearance` field group to Forms collection; (3) extend `PublicFormClient` to honor `displayMode` and apply background styles; (4) replace Payload's default Forms edit view with a custom React view that hosts proper page-level Build/Settings/Submissions tabs.

**Tech Stack:** unchanged from v1.

---

## Pre-flight

- [ ] On `feat/tenant-forms` at the repo root. Working tree clean (or only `.claude/worktrees/`).
- [ ] `npm test --silent` passes (baseline at v1 ship: 329 tests).
- [ ] `npx tsc --noEmit` clean.

---

## File map

**New:**
- `src/app/(forms)/layout.tsx` — minimal HTML root with tenant logo header + footer. No site chrome.
- `src/app/(forms)/forms/[slug]/page.tsx` (moved from `(site)`)
- `src/app/(forms)/forms/[slug]/PublicFormClient.tsx` (moved)
- `src/app/(forms)/forms/[slug]/thanks/page.tsx` (moved)
- `src/admin/forms/FormEditView.tsx` — custom edit view replacing Payload's default
- `src/admin/forms/SubmissionsTab.tsx` — small recent-submissions list inside the Submissions tab
- `src/admin/forms/settings/sections/Appearance.tsx` — new settings sub-section
- `src/lib/form-appearance.ts` — pure helpers: `computeBackgroundCss`, `flattenStepsForOnePerPage`, `resolveSubmissionMessage`
- `tests/lib/form-appearance.test.ts`

**Modified:**
- `src/collections/Forms.ts` — add `appearance` group; remove `admin.components.Field` on the `schema` field; set `admin.components.views.edit.default.Component`.
- `src/components/PublicFormSuccess.tsx` — use `resolveSubmissionMessage`.
- `src/styles/public-forms.css` — `--pf-bg` consumption + standalone-layout polish (header bar, footer).
- `src/admin/forms/settings/SettingsNav.tsx` — add "Appearance" item, ensure ordering.
- `src/admin/forms/settings/SettingsPanel.tsx` — render Appearance section when active.

**Deleted:**
- `src/app/(site)/forms/[slug]/page.tsx`, `PublicFormClient.tsx`, `thanks/page.tsx`
- `src/admin/forms/FormToolbar.tsx`, `src/admin/forms/toolbar.css`
- `src/admin/forms/FormBuilderField.tsx` (the wrapper that used to host the toolbar — its child `FormBuilderField.client.tsx` survives, mounted directly inside FormEditView)

**Generated:**
- `src/migrations/<timestamp>_forms_appearance.ts`
- `src/payload-types.ts`

---

## Phase V1 — Schema + migration

### Task V1-1: add `appearance` group to Forms collection

**Files:**
- Modify: `src/collections/Forms.ts`
- Modify: `src/payload.config.ts` — no change needed; collection already registered

- [ ] **Step 1:** Add the `appearance` group field (alongside `settings` and `payment`):

```ts
{
  name: 'appearance',
  type: 'group',
  fields: [
    {
      name: 'displayMode',
      type: 'select',
      defaultValue: 'all-at-once',
      options: [
        { label: 'All questions on one page', value: 'all-at-once' },
        { label: 'One question per page (Typeform-style)', value: 'one-per-page' },
      ],
      admin: { description: 'How visitors progress through the form.' },
    },
    {
      name: 'introMessage',
      type: 'richText',
      admin: { description: 'Optional message shown above the first field.' },
    },
    {
      name: 'submissionMessage',
      type: 'richText',
      admin: { description: 'Shown after a successful submission. If left blank, falls back to the older Settings → Confirmation message.' },
    },
    {
      name: 'backgroundColor',
      type: 'text',
      admin: {
        description: 'Solid background color for the public form (hex like #FAF9F4). Ignored if a gradient is set below.',
        placeholder: '#FAF9F4',
      },
    },
    {
      name: 'backgroundGradient',
      type: 'group',
      fields: [
        { name: 'from', type: 'text', admin: { placeholder: '#1B3358' } },
        { name: 'to', type: 'text', admin: { placeholder: '#0E1B2C' } },
        {
          name: 'direction',
          type: 'select',
          defaultValue: 'vertical',
          options: [
            { label: 'Top → Bottom', value: 'vertical' },
            { label: 'Left → Right', value: 'horizontal' },
            { label: 'Diagonal (TL → BR)', value: 'diagonal' },
          ],
        },
      ],
      admin: { description: 'Optional gradient. When `from` is set, it overrides the solid color above.' },
    },
  ],
}
```

- [ ] **Step 2:** Remove the existing `admin.components.Field` on the `schema` field (lines around `components: { Field: '/src/admin/forms/FormBuilderField#default' }`). Builder will be mounted by `FormEditView` instead.

- [ ] **Step 3:** Add `admin.components.views.edit.default.Component` at the top of `Forms.admin.components`:

```ts
admin: {
  group: 'Forms',
  useAsTitle: 'title',
  defaultColumns: ['title', 'status', 'submissionsCount', 'updatedAt'],
  components: {
    views: {
      edit: {
        default: { Component: '/src/admin/forms/FormEditView#default' },
      },
    },
  },
},
```

- [ ] **Step 4:** Generate types + migration:

```bash
npm run payload generate:types
npm run payload migrate:create -- --name forms_appearance
```

If the generated migration includes diffs unrelated to `appearance` (snapshot drift), edit it down to ONLY the appearance columns + the column drop on `schema_field`'s admin component reference (none expected).

- [ ] **Step 5:** Run tests; expected baseline still passes plus generation steps.

- [ ] **Step 6:** Commit: `feat(forms-v2): appearance group on Forms collection + custom edit-view wiring`.

---

## Phase V2 — Public form helpers + appearance rendering

### Task V2-1: `form-appearance.ts` lib + tests

**Files:**
- Create: `src/lib/form-appearance.ts`
- Create: `tests/lib/form-appearance.test.ts`

- [ ] **Step 1:** Failing tests:

```ts
// tests/lib/form-appearance.test.ts
import { describe, it, expect } from 'vitest'
import {
  computeBackgroundCss,
  flattenStepsForOnePerPage,
  resolveSubmissionMessage,
} from '@/lib/form-appearance'
import type { FormSchema } from '@/lib/form-schema'

describe('computeBackgroundCss', () => {
  it('returns undefined when no appearance set', () => {
    expect(computeBackgroundCss(undefined)).toBeUndefined()
    expect(computeBackgroundCss({})).toBeUndefined()
  })
  it('returns the solid color when only color is set', () => {
    expect(computeBackgroundCss({ backgroundColor: '#FAF9F4' })).toBe('#FAF9F4')
  })
  it('returns a gradient when from is set, ignoring color', () => {
    const css = computeBackgroundCss({
      backgroundColor: '#FFFFFF',
      backgroundGradient: { from: '#1B3358', to: '#0E1B2C', direction: 'vertical' },
    })
    expect(css).toBe('linear-gradient(180deg, #1B3358, #0E1B2C)')
  })
  it('uses the right angle for each direction', () => {
    const make = (direction: 'vertical' | 'horizontal' | 'diagonal') =>
      computeBackgroundCss({
        backgroundGradient: { from: '#000', to: '#fff', direction },
      })
    expect(make('vertical')).toBe('linear-gradient(180deg, #000, #fff)')
    expect(make('horizontal')).toBe('linear-gradient(90deg, #000, #fff)')
    expect(make('diagonal')).toBe('linear-gradient(135deg, #000, #fff)')
  })
})

describe('flattenStepsForOnePerPage', () => {
  const schema: FormSchema = {
    steps: [
      { id: 's1', fields: [
        { type: 'short-text', id: 'f1', name: 'name', label: 'Name', required: true },
        { type: 'page-break', id: 'pb1', name: 'pb1' },
        { type: 'email', id: 'f2', name: 'email', label: 'Email', required: true },
      ]},
      { id: 's2', fields: [
        { type: 'short-text', id: 'f3', name: 'note', label: 'Note', required: false },
      ]},
    ],
  }
  it('returns one step per non-page-break field, in order', () => {
    const flat = flattenStepsForOnePerPage(schema)
    expect(flat.steps.length).toBe(3)
    expect(flat.steps.map((s) => s.fields[0].id)).toEqual(['f1', 'f2', 'f3'])
  })
  it('drops page-break fields entirely', () => {
    const flat = flattenStepsForOnePerPage(schema)
    expect(flat.steps.flatMap((s) => s.fields).find((f) => f.type === 'page-break')).toBeUndefined()
  })
  it('returns empty steps array when schema has no non-page-break fields', () => {
    const empty: FormSchema = { steps: [{ id: 's1', fields: [{ type: 'page-break', id: 'pb', name: 'pb' }] }] }
    expect(flattenStepsForOnePerPage(empty).steps).toEqual([])
  })
})

describe('resolveSubmissionMessage', () => {
  it('prefers appearance.submissionMessage when present', () => {
    const result = resolveSubmissionMessage({
      appearance: { submissionMessage: { root: { type: 'root' } } as any },
      settings: { successMessage: { root: { type: 'root', text: 'old' } } as any },
    })
    expect(result).toEqual({ root: { type: 'root' } })
  })
  it('falls back to settings.successMessage when appearance not set', () => {
    const result = resolveSubmissionMessage({
      settings: { successMessage: { root: { type: 'root', text: 'old' } } as any },
    })
    expect(result).toEqual({ root: { type: 'root', text: 'old' } })
  })
  it('returns null when neither is set', () => {
    expect(resolveSubmissionMessage({})).toBeNull()
  })
})
```

- [ ] **Step 2:** Implement `src/lib/form-appearance.ts`:

```ts
import type { FormSchema, Field } from './form-schema'

export interface Appearance {
  displayMode?: 'all-at-once' | 'one-per-page'
  introMessage?: unknown
  submissionMessage?: unknown
  backgroundColor?: string | null
  backgroundGradient?: {
    from?: string | null
    to?: string | null
    direction?: 'vertical' | 'horizontal' | 'diagonal' | null
  } | null
}

const DIRECTION_TO_DEG = {
  vertical: '180deg',
  horizontal: '90deg',
  diagonal: '135deg',
} as const

export function computeBackgroundCss(appearance: Appearance | undefined): string | undefined {
  if (!appearance) return undefined
  const grad = appearance.backgroundGradient
  if (grad?.from) {
    const direction = (grad.direction ?? 'vertical') as keyof typeof DIRECTION_TO_DEG
    const deg = DIRECTION_TO_DEG[direction] ?? DIRECTION_TO_DEG.vertical
    const to = grad.to || grad.from
    return `linear-gradient(${deg}, ${grad.from}, ${to})`
  }
  if (appearance.backgroundColor) return appearance.backgroundColor
  return undefined
}

export function flattenStepsForOnePerPage(schema: FormSchema): FormSchema {
  const out: FormSchema = { steps: [] }
  for (const step of schema.steps) {
    for (const f of step.fields as Field[]) {
      if (f.type === 'page-break') continue
      out.steps.push({ id: `vstep-${f.id}`, fields: [f] })
    }
  }
  return out
}

interface MessageHolder {
  appearance?: { submissionMessage?: unknown } | null
  settings?: { successMessage?: unknown } | null
}

export function resolveSubmissionMessage(form: MessageHolder): unknown | null {
  return form.appearance?.submissionMessage ?? form.settings?.successMessage ?? null
}
```

- [ ] **Step 3:** Run tests, pass.

- [ ] **Step 4:** Commit: `feat(forms-v2): appearance computeBackgroundCss + flatten helpers`.

### Task V2-2: standalone (forms) route group + layout

**Files:**
- Create: `src/app/(forms)/layout.tsx`
- Move: `src/app/(site)/forms/[slug]/page.tsx` → `src/app/(forms)/forms/[slug]/page.tsx`
- Move: `src/app/(site)/forms/[slug]/PublicFormClient.tsx` → `src/app/(forms)/forms/[slug]/PublicFormClient.tsx`
- Move: `src/app/(site)/forms/[slug]/thanks/page.tsx` → `src/app/(forms)/forms/[slug]/thanks/page.tsx`
- Modify: `src/styles/public-forms.css` — add minimal header/footer rules + `--pf-bg`

- [ ] **Step 1:** Use `git mv` for the three files (preserves history). Update internal imports to remain valid.

- [ ] **Step 2:** Create `src/app/(forms)/layout.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Geist } from 'next/font/google'
import { fraunces, inter, amiri } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { getCurrentTenant } from '@/lib/tenant-server'
import { computeBackgroundCss, type Appearance } from '@/lib/form-appearance'
import { mediaUrl } from '@/components/types'
import '@/app/globals.css'
import '@/styles/public-forms.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

interface FormsLayoutProps {
  children: ReactNode
}

export default async function FormsLayout({ children }: FormsLayoutProps) {
  const tenant = await getCurrentTenant()
  const tenantName = tenant?.name ?? 'OpenMasjid'
  const logoUrl = mediaUrl(tenant?.branding?.logo as never) ?? null
  const brandColor = (tenant?.branding as { primaryColor?: string } | undefined)?.primaryColor

  return (
    <html lang="en" className={cn(fraunces.variable, inter.variable, amiri.variable, 'font-sans', geist.variable)}>
      <body className="font-body bg-bg text-fg2 antialiased">
        <div
          className="om-pf-shell"
          style={{
            ['--pf-brand' as string]: brandColor || undefined,
          }}
        >
          <header className="om-pf-tenant-header">
            {logoUrl && <img src={logoUrl} alt="" className="om-pf-tenant-logo" />}
            <span className="om-pf-tenant-name">{tenantName}</span>
          </header>
          {children}
          <footer className="om-pf-platform-footer">
            <span>Submissions are private to your masjid · Powered by <strong>OpenMasjid</strong></span>
          </footer>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 3:** Update the moved `page.tsx`:
  - Drop the `<div className="om-pf-shell">` wrapper (the layout now provides it)
  - Compute background CSS from `tenant + form.appearance` and apply via `style` to the form section. Or wrap the inner content in a `<section>` that sets `--pf-bg`.
  - Keep the form title H1 + description block from the v1 fix.

```tsx
// inside the page render:
const appearance = (form as any).appearance as Appearance | undefined
const backgroundCss = computeBackgroundCss(appearance)
return (
  <section
    className="om-pf-form-area"
    style={backgroundCss ? ({ '--pf-bg': backgroundCss } as React.CSSProperties) : undefined}
  >
    <div className="om-pf-form-area__inner">
      <header className="om-pf-header">
        <h1 className="om-pf-title">{form.title}</h1>
        {form.description ? (
          <RichText data={form.description as never} className="om-pf-description" />
        ) : null}
        {appearance?.introMessage ? (
          <RichText data={appearance.introMessage as never} className="om-pf-intro" />
        ) : null}
      </header>
      <PublicFormClient form={form as any} closed={closed} />
    </div>
  </section>
)
```

- [ ] **Step 4:** Update `src/styles/public-forms.css`:
  - Tenant header bar: 56px tall, white background with bottom 1px border, logo (28px max) + masjid name (sans 14px 600), padding 16/24
  - Platform footer: small (text-xs grey) line, centered, padding 16/0
  - `.om-pf-form-area` reads `--pf-bg`; outer shell stays neutral; the form area is what gets styled.
  - `.om-pf-form-area__inner`: max-width 760, mx-auto, padding 48px 16px 64px

- [ ] **Step 5:** Confirm the deleted `(site)` form paths actually delete (`git status` should show `D`).

- [ ] **Step 6:** Manual smoke (optional given dev DB requirement): visit a tenant subdomain `/forms/test`, verify no prayer strip / site footer.

- [ ] **Step 7:** Tests + tsc.

- [ ] **Step 8:** Commit: `feat(forms-v2): standalone (forms) route group + minimal tenant-branded layout`.

### Task V2-3: PublicFormClient — displayMode + intro/submission message

**Files:**
- Modify: `src/app/(forms)/forms/[slug]/PublicFormClient.tsx`
- Modify: `src/components/PublicFormSuccess.tsx`

- [ ] **Step 1:** In `PublicFormClient`:
  - Read `appearance.displayMode` from `form.appearance` (default 'all-at-once')
  - At mount: if `displayMode === 'one-per-page'`, replace `schema` with `flattenStepsForOnePerPage(schema)`
  - Otherwise, behave as today
  - When `displayMode === 'one-per-page'` AND focused field is `short-text` / `email` / `phone` / `number` / `date`: pressing Enter advances if step is valid. Use `onKeyDown` on the form, intercept Enter when target is one of those input types.
  - Add a small ghost "Press Enter ↵ to continue" hint when in one-per-page mode and current step has a single text-like field.

- [ ] **Step 2:** In `PublicFormSuccess`:
  - Replace direct read of `form.settings?.successMessage` with `resolveSubmissionMessage(form)`
  - If non-null, render via `<RichText data={msg as never} />`. Otherwise fall back to current default text.

- [ ] **Step 3:** Tests pass + tsc.

- [ ] **Step 4:** Commit: `feat(forms-v2): one-per-page display mode + appearance.submissionMessage`.

---

## Phase V3 — Admin: Appearance settings section

### Task V3-1: Appearance section + nav entry

**Files:**
- Create: `src/admin/forms/settings/sections/Appearance.tsx`
- Modify: `src/admin/forms/settings/SettingsNav.tsx` (add nav item)
- Modify: `src/admin/forms/settings/SettingsPanel.tsx` (route to Appearance section)
- Modify: `src/admin/forms/settings/index.ts` (export new id)

- [ ] **Step 1:** In `SettingsNav.tsx`, insert "Appearance" between "Confirmation" and "Webhooks":

```tsx
{ id: 'appearance', label: 'Appearance', icon: <Palette size={14} /> }
```

(use lucide `Palette` icon)

- [ ] **Step 2:** Implement `Appearance.tsx`:
  - Display Mode select (`useField('appearance.displayMode')`)
  - Intro message — render an "Edit in main view" link (richText editing inside a custom panel is hard; mirror Confirmation section's approach)
  - Submission message — same pattern
  - Background color — text input with a small color swatch + native color picker fallback (`<input type="color">`)
  - Background gradient — three controls (from, to, direction). When `from` is set, show a small live preview swatch
  - Helper copy at the top: "Customize how the form looks and feels."

Render them as 3-4 stacked cards within the section.

- [ ] **Step 3:** Update `SettingsPanel.tsx` switch to render `<Appearance />` for the new section id.

- [ ] **Step 4:** Update `SettingsSectionId` union type to include `'appearance'`.

- [ ] **Step 5:** tsc + tests.

- [ ] **Step 6:** Commit: `feat(forms-v2): admin Appearance settings section`.

---

## Phase V4 — Custom Forms admin edit view

### Task V4-1: FormEditView + SubmissionsTab + delete old wrappers

**Files:**
- Create: `src/admin/forms/FormEditView.tsx`
- Create: `src/admin/forms/SubmissionsTab.tsx`
- Delete: `src/admin/forms/FormToolbar.tsx`, `src/admin/forms/toolbar.css`
- Delete: `src/admin/forms/FormBuilderField.tsx` (the 'use client' wrapper). `FormBuilderField.client.tsx` is now imported directly into `FormEditView`.
- Modify: `src/app/(payload)/admin/importMap.js` — Payload re-generates this; just verify it picks up the new view component.

- [ ] **Step 1:** Implement `SubmissionsTab.tsx` (server component is fine — it just lists recent submissions):

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props { formId: string | number }

export default function SubmissionsTab({ formId }: Props) {
  const [docs, setDocs] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/form-submissions?where[form][equals]=${formId}&limit=10&sort=-submittedAt`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setDocs(res?.docs ?? []))
      .finally(() => setLoading(false))
  }, [formId])
  if (loading) return <div className="fev-tab-empty">Loading…</div>
  if (docs.length === 0) return <div className="fev-tab-empty">No submissions yet.</div>
  return (
    <div className="fev-subs">
      <table className="fev-subs-table">
        <thead><tr><th>Submitted</th><th>Email</th><th>Status</th><th>Payment</th></tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id}>
              <td>{new Date(d.submittedAt).toLocaleString()}</td>
              <td>{d.submitterEmail ?? '—'}</td>
              <td>{d.status}</td>
              <td>{d.paymentStatus === 'na' ? '—' : d.paymentStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link href={`/admin/collections/form-submissions?where[form][equals]=${formId}`} className="fev-subs-all">
        View all submissions →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2:** Implement `FormEditView.tsx` ('use client') — replaces Payload's default edit view:

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useDocumentInfo, useField } from '@payloadcms/ui'
import { ExternalLink, Eye } from 'lucide-react'
import { FormBuilderFieldClient } from './FormBuilderField.client'
import SettingsPanel from './settings/SettingsPanel'
import type { SettingsSectionId } from './settings/SettingsNav'
import SubmissionsTab from './SubmissionsTab'
import './form-edit-view.css'

type Tab = 'build' | 'settings' | 'submissions'

export default function FormEditView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawTab = searchParams.get('tab') as Tab | null
  const activeTab: Tab = rawTab === 'settings' || rawTab === 'submissions' ? rawTab : 'build'

  const [settingsSection, setSettingsSection] = useState<SettingsSectionId>('basics')

  const { value: title } = useField<string>({ path: 'title' })
  const { value: slug } = useField<string>({ path: 'slug' })
  const { value: status } = useField<string>({ path: 'status' })
  const { value: tenantField } = useField<unknown>({ path: 'tenant' })
  const tenantId = tenantField && typeof tenantField === 'object' && 'id' in (tenantField as object)
    ? (tenantField as { id: string | number }).id
    : (tenantField as string | number | null)

  const docInfo = useDocumentInfo()
  const formId = (docInfo as { id?: string | number }).id ?? null

  const { submit, isProcessing, hasSubmitted } = useForm() as {
    submit: () => Promise<void>
    isProcessing: boolean
    hasSubmitted: boolean
  }

  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  useEffect(() => {
    if (!tenantId) return
    let cancelled = false
    fetch(`/api/tenants/${tenantId}?depth=0`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.slug) setTenantSlug(d.slug) })
    return () => { cancelled = true }
  }, [tenantId])

  const handleTabClick = useCallback((tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'build') params.delete('tab'); else params.set('tab', tab)
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const publicUrl = (() => {
    if (!slug) return null
    if (typeof window === 'undefined') return `/forms/${slug}`
    const host = window.location.host
    const firstLabel = host.split(':')[0].split('.')[0].toLowerCase()
    const isBareLocal = firstLabel === 'localhost' || firstLabel === '127' || firstLabel === '0'
    const isAdminHost = firstLabel === 'admin'
    if ((isBareLocal || isAdminHost) && tenantSlug) {
      return `${window.location.protocol}//${tenantSlug}.${host}/forms/${slug}`
    }
    return `/forms/${slug}`
  })()

  return (
    <div className="fev-root">
      <div className="fev-bar">
        <div className="fev-meta">
          <span className="fev-meta__title">{title || 'Untitled form'}</span>
          {status && <span className={`fev-status fev-status--${status}`}>{status}</span>}
          {slug && <span className="fev-meta__slug">/{slug}</span>}
        </div>
        <div className="fev-actions">
          <div className="fev-tabs" role="tablist">
            {(['build', 'settings', 'submissions'] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={activeTab === t}
                className={`fev-tab${activeTab === t ? ' fev-tab--active' : ''}`}
                onClick={() => handleTabClick(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {publicUrl && (
            <a className="fev-btn fev-btn--ghost" href={publicUrl} target="_blank" rel="noopener noreferrer">
              <Eye size={14} /> Preview
            </a>
          )}
          {publicUrl && (
            <a className="fev-btn fev-btn--ghost" href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> View live
            </a>
          )}
          <button type="button" className="fev-btn fev-btn--primary"
            onClick={() => submit()} disabled={isProcessing}>
            {isProcessing ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="fev-panel" role="tabpanel">
        {activeTab === 'build' && <FormBuilderFieldClient />}
        {activeTab === 'settings' && (
          <SettingsPanel section={settingsSection} onSectionChange={setSettingsSection} />
        )}
        {activeTab === 'submissions' && formId !== null && <SubmissionsTab formId={formId} />}
      </div>
    </div>
  )
}
```

(Note: `FormBuilderFieldClient` already calls `useField('schema')` internally, so no schema prop wiring needed.)

- [ ] **Step 3:** Add `src/admin/forms/form-edit-view.css` — port the relevant styles from `toolbar.css`. Wider full-page layout. The bar is no longer "sticky" to a Field card — it's the page header.

- [ ] **Step 4:** Delete `src/admin/forms/FormToolbar.tsx`, `toolbar.css`, and `FormBuilderField.tsx` (the wrapper). Verify imports.

- [ ] **Step 5:** `npm test` + `npx tsc --noEmit`. Manual smoke if dev DB available.

- [ ] **Step 6:** Commit: `feat(forms-v2): custom Forms edit view with page-level Build/Settings/Submissions tabs`.

---

## Phase V5 — Final verification + PR

### Task V5-1: integration test pass

- [ ] `npm test --silent` — all green
- [ ] `npx tsc --noEmit` — clean
- [ ] Manual end-to-end:
  - Create a form, set displayMode=one-per-page, set background gradient, set intro message
  - Visit public URL on tenant subdomain — verify standalone layout, gradient background, intro message above first field, one-per-page navigation
  - Submit — success page renders the appearance.submissionMessage
  - Admin: Build/Settings/Submissions tabs work as page-level tabs
  - Save button in toolbar commits

### Task V5-2: open PR (or push to PR #67)

- [ ] If PR #67 is still open, push to `feat/tenant-forms` (auto-updates the PR)
- [ ] Otherwise, open a new PR titled `feat: tenant form builder v2 (standalone layout, one-per-page, appearance, custom edit view)` linking to the v1 PR for context.

---

## Self-review

- **Spec coverage:** every section of v2 spec maps to a phase task: standalone layout (V2-2), display mode (V2-1, V2-3), appearance fields (V1-1, V2-1, V3-1), custom edit view (V4-1). ✓
- **Migration safety:** appearance is additive — no data loss, no rename. `settings.successMessage` stays in place. ✓
- **Backwards compat:** `resolveSubmissionMessage` fallback ensures pre-v2 forms keep showing their success message. ✓
- **Test coverage:** core helpers (`computeBackgroundCss`, `flattenStepsForOnePerPage`, `resolveSubmissionMessage`) have unit tests. Public-form rendering and the custom edit view rely on type-check + manual verification (consistent with v1 pattern). ✓
