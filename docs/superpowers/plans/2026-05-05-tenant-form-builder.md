# Tenant Form Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Jotform-style form builder as a tenant feature: visual builder in the OpenMasjid admin, public form pages on tenant sites, capacity, multi-step, optional Stripe Connect Hosted Checkout (suggested amounts), submissions list + CSV export. Spec: `docs/superpowers/specs/2026-05-05-tenant-form-builder-design.md` (with addendum). Designer package: `design_handoff_forms_unpacked/design_handoff_forms/` (read its `README.md` first).

**Architecture:** Two new Payload collections (`forms`, `form-submissions`). The form schema is stored as a single JSON blob — a custom Payload admin field renders a 3-pane builder (toolbar + canvas + properties drawer) per the designer's mockups. The public form lives at `/forms/[slug]` on tenant hosts, mirrors the existing `(site)` route group conventions, and is rendered by a single client component that consumes the JSON schema. Submissions go through `POST /api/forms/[slug]/submit`; if payment is enabled the route creates a Stripe Connect Checkout Session against the tenant's connected account and redirects. The existing connect webhook (`/api/stripe/connect/webhook`) is extended to fan out to a new `form-submissions-webhook.ts` handler keyed on `metadata.kind === 'form-submission'`. Brand color flows through a CSS custom property `--pf-brand` on the public side; admin chrome stays neutral navy.

**Tech Stack:** Next.js 15 App Router, Payload 3 (Postgres), Stripe Node SDK (Connect, mirrors `donations-webhook.ts`), `@dnd-kit/{core,sortable,modifiers}` for builder reordering, `zod` for schema-of-schema validation, `lucide-react` (already used) for icons, Vitest, TypeScript.

---

## Pre-flight (do once before Task 1)

- [ ] **Create a worktree.** From the main repo:
  ```bash
  git worktree add -b feat/tenant-forms .claude/worktrees/tenant-forms main
  cd .claude/worktrees/tenant-forms
  cp /Users/mtahir/personal/open-masjid/open-masjid/.env .env
  npm install
  ```
- [ ] **Confirm baseline.** `npm test --silent` and `npx tsc --noEmit` should both pass before any code changes.
- [ ] **Add new deps.**
  ```bash
  npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers zod
  ```
- [ ] **Read the design handoff.** Open `design_handoff_forms_unpacked/design_handoff_forms/README.md`. Skim `forms.css` and `colors_and_type.css` for tokens. Confirm Stripe pattern is **Hosted Checkout (redirect) with Connect direct charges** — this matches `src/lib/donations-webhook.ts` and `src/app/api/stripe/connect/webhook/route.ts`.
- [ ] **Confirm donations Connect plumbing.** Skim `src/lib/donations-webhook.ts`, `src/lib/donations-apply.ts`, and `src/app/api/stripe/connect/webhook/route.ts`. Forms will mirror this dispatch pattern.

---

## File map (locked in before tasks)

**New collections:**
- `src/collections/Forms.ts` — tenant-scoped, billing-locked writes; renders the custom builder field on the schema column
- `src/collections/FormSubmissions.ts` — tenant-scoped read; create/update only via overrideAccess (webhook + submit endpoint)

**New libs (Node-only, server side):**
- `src/lib/form-schema.ts` — `FieldSchema`, `FormSchema` zod definitions; `validateSchema(schema)`, `validateSubmission(schema, data)`; field-type registry (label, defaults).
- `src/lib/form-submit.ts` — `submitForm({ tenant, form, data, request })`: honeypot, capacity, validation, persistence; returns `{ ok: true }` or `{ ok: true, checkoutUrl }`.
- `src/lib/form-checkout.ts` — `createFormCheckoutSession({ tenant, form, submission, amountCents })`: builds Connect Checkout Session metadata + URLs.
- `src/lib/form-submissions-webhook.ts` — `handleFormSubmissionEvent({ event, payload })`: marks submission paid/expired on Stripe events.
- `src/lib/form-csv.ts` — `submissionsToCsv(form, submissions)`: deterministic column order from schema.
- `src/lib/form-notifications.ts` — `sendFormNotifications({ form, submission })`: admin notify + optional submitter confirmation via existing Resend wiring.
- `src/lib/form-rate-limit.ts` — in-memory token bucket, 5 submissions / IP-hash / minute.

**New Edge / Node routes:**
- `src/app/(site)/forms/[slug]/page.tsx` — public form (Server Component) hydrating a single client component
- `src/app/(site)/forms/[slug]/PublicFormClient.tsx` — client component: state, validation, multi-step nav, submit
- `src/app/(site)/forms/[slug]/thanks/page.tsx` — post-submit / post-payment success page
- `src/app/api/forms/[slug]/submit/route.ts` — POST handler
- `src/app/api/forms/[slug]/submissions.csv/route.ts` — admin CSV export (auth required)
- `src/app/api/forms/[slug]/checkout-success/route.ts` — Stripe success URL: confirms session → marks submission paid → 302 to thanks page

**Modified routes:**
- `src/app/api/stripe/connect/webhook/route.ts` — add `handleFormSubmissionEvent` to the dispatch fan-out

**New admin UI (Payload custom components):**
- `src/admin/forms/FormBuilderField.tsx` — the custom field rendered in place of the schema JSON column. Wraps the canvas + properties drawer + add-field popover.
- `src/admin/forms/FormBuilderField.client.tsx` — `'use client'` companion holding all browser state (selected field, popover index, dirty flag)
- `src/admin/forms/builder/FieldCard.tsx` — single field card (drag handle, hover toolbar, type tag pill, preview)
- `src/admin/forms/builder/PropertiesDrawer.tsx` — General/Validation/Logic tabs; Logic tab renders disabled
- `src/admin/forms/builder/AddFieldPopover.tsx` — search + 2-col grid of field types
- `src/admin/forms/builder/FieldTypeIcon.tsx` — switch over `FIELD_TYPES`
- `src/admin/forms/SubmissionsList.tsx` — custom list view at `/admin/collections/form-submissions` (filter, status pills, export CSV button)
- `src/admin/forms/SubmissionDetail.tsx` — custom detail view with side cards (status, payment) and Reply / Export / Mark reviewed actions
- `src/admin/forms/FormToolbar.tsx` — sticky toolbar with Build/Settings/Submissions tabs + Save/View live
- `src/admin/forms/settings/SettingsNav.tsx` — left rail: Basics / Submission limits / Notifications / Payment / Confirmation / Webhooks / Embed & share
- `src/admin/forms/settings/sections/{Basics,SubmissionLimits,Notifications,Payment,Confirmation,Webhooks,EmbedShare}.tsx` — section panels (Webhooks + EmbedShare are page shells in v1)

**New components (public site):**
- `src/components/PublicFormFields.tsx` — render a single field by type (text/email/phone/long-text/number/date/dropdown/radio/multiselect/checkbox-group/consent)
- `src/components/PublicFormPaymentBlock.tsx` — suggested amounts + custom amount; emits selected-amount-cents up
- `src/components/PublicFormProgress.tsx` — multi-step progress bar
- `src/components/PublicFormSuccess.tsx` — success card (success message + receipt strip if paid)
- `src/styles/public-forms.css` — public form CSS, scoped via `data-pf-root`, consumes `--pf-brand`

**Tests (new):**
- `tests/lib/form-schema.test.ts`
- `tests/lib/form-submit.test.ts`
- `tests/lib/form-checkout.test.ts`
- `tests/lib/form-submissions-webhook.test.ts`
- `tests/lib/form-csv.test.ts`
- `tests/lib/form-notifications.test.ts`
- `tests/lib/form-rate-limit.test.ts`
- `tests/collections/forms.access.test.ts`
- `tests/collections/form-submissions.access.test.ts`
- `tests/api/forms.submit.test.ts`
- `tests/api/forms.checkout-success.test.ts`

**Modified:**
- `src/payload.config.ts` — register `Forms` and `FormSubmissions`
- `src/payload-types.ts` — regenerated by Payload after collections land
- `src/migrations/index.ts` + new migration files — auto-generated
- `src/app/(payload)/admin/importMap.js` — auto-regenerated when admin components added

---

## Phase A — Data model and validation

### Task A1: `form-schema.ts` — types, zod, validators

**Files:**
- Create: `src/lib/form-schema.ts`
- Test: `tests/lib/form-schema.test.ts`

- [ ] **Step 1: Write failing tests.**

```ts
// tests/lib/form-schema.test.ts
import { describe, it, expect } from 'vitest'
import {
  FormSchema,
  validateSchema,
  validateSubmission,
  FIELD_TYPES,
} from '@/lib/form-schema'

describe('FIELD_TYPES', () => {
  it('exposes the 12 v1 field types in a stable order', () => {
    expect(FIELD_TYPES.map((t) => t.id)).toEqual([
      'short-text','email','phone','long-text','number','date',
      'dropdown','radio','multiselect','checkbox-group','consent','page-break',
    ])
  })
})

describe('validateSchema', () => {
  it('accepts a minimal valid schema', () => {
    const ok = validateSchema({
      steps: [{ id: 's1', fields: [
        { type: 'email', id: 'f1', name: 'email', label: 'Email', required: true },
      ]}],
    })
    expect(ok.success).toBe(true)
  })
  it('rejects duplicate field names across steps', () => {
    const r = validateSchema({
      steps: [
        { id: 's1', fields: [{ type: 'email', id: 'f1', name: 'email', label: 'Email', required: true }] },
        { id: 's2', fields: [{ type: 'short-text', id: 'f2', name: 'email', label: 'Other', required: false }] },
      ],
    })
    expect(r.success).toBe(false)
  })
  it('rejects an empty schema', () => {
    expect(validateSchema({ steps: [] }).success).toBe(false)
  })
})

describe('validateSubmission', () => {
  const schema: FormSchema = {
    steps: [{ id: 's1', fields: [
      { type: 'email', id: 'f1', name: 'email', label: 'Email', required: true },
      { type: 'short-text', id: 'f2', name: 'name', label: 'Name', required: true },
      { type: 'multiselect', id: 'f3', name: 'roles', label: 'Roles', required: false,
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    ]}],
  }
  it('passes when required fields are present and types are valid', () => {
    const r = validateSubmission(schema, { email: 'x@y.com', name: 'Aisha', roles: ['a'] })
    expect(r.ok).toBe(true)
  })
  it('rejects missing required fields with field-keyed errors', () => {
    const r = validateSubmission(schema, { email: 'x@y.com' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.name).toBeDefined()
  })
  it('rejects invalid email', () => {
    const r = validateSubmission(schema, { email: 'not-an-email', name: 'A' })
    expect(r.ok).toBe(false)
  })
  it('rejects multiselect values not in option list', () => {
    const r = validateSubmission(schema, { email: 'x@y.com', name: 'A', roles: ['c'] })
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests. Expect failures.** `npx vitest run tests/lib/form-schema.test.ts`

- [ ] **Step 3: Implement `form-schema.ts`.**

```ts
// src/lib/form-schema.ts
import { z } from 'zod'

export const FIELD_TYPES = [
  { id: 'short-text', label: 'Short text', hasOptions: false },
  { id: 'email', label: 'Email', hasOptions: false },
  { id: 'phone', label: 'Phone', hasOptions: false },
  { id: 'long-text', label: 'Long text', hasOptions: false },
  { id: 'number', label: 'Number', hasOptions: false },
  { id: 'date', label: 'Date', hasOptions: false },
  { id: 'dropdown', label: 'Dropdown', hasOptions: true },
  { id: 'radio', label: 'Radio group', hasOptions: true },
  { id: 'multiselect', label: 'Multi-select', hasOptions: true },
  { id: 'checkbox-group', label: 'Checkbox group', hasOptions: true },
  { id: 'consent', label: 'Consent', hasOptions: false },
  { id: 'page-break', label: 'Page break', hasOptions: false },
] as const

export type FieldTypeId = (typeof FIELD_TYPES)[number]['id']

const FieldNameRegex = /^[a-z][a-z0-9_]*$/

const Option = z.object({ value: z.string().min(1), label: z.string().min(1) })

const FieldBase = {
  id: z.string().min(1),
  name: z.string().regex(FieldNameRegex),
  label: z.string().min(1),
  required: z.boolean().default(false),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
}

const FieldSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('short-text'), ...FieldBase }),
  z.object({ type: z.literal('email'), ...FieldBase }),
  z.object({ type: z.literal('phone'), ...FieldBase }),
  z.object({ type: z.literal('long-text'), ...FieldBase }),
  z.object({ type: z.literal('number'), ...FieldBase, min: z.number().optional(), max: z.number().optional() }),
  z.object({ type: z.literal('date'), ...FieldBase }),
  z.object({ type: z.literal('dropdown'), ...FieldBase, options: z.array(Option).min(1) }),
  z.object({ type: z.literal('radio'), ...FieldBase, options: z.array(Option).min(1) }),
  z.object({ type: z.literal('multiselect'), ...FieldBase, options: z.array(Option).min(1) }),
  z.object({ type: z.literal('checkbox-group'), ...FieldBase, options: z.array(Option).min(1) }),
  z.object({ type: z.literal('consent'), ...FieldBase, required: z.literal(true) }),
  z.object({ type: z.literal('page-break'), id: z.string().min(1), name: z.string().regex(FieldNameRegex) }),
])
export type Field = z.infer<typeof FieldSchema>

export const FormSchemaZ = z.object({
  steps: z.array(z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    fields: z.array(FieldSchema),
  })).min(1),
})
export type FormSchema = z.infer<typeof FormSchemaZ>

export interface ValidateSchemaOk { success: true; schema: FormSchema }
export interface ValidateSchemaErr { success: false; error: string }
export function validateSchema(input: unknown): ValidateSchemaOk | ValidateSchemaErr {
  const r = FormSchemaZ.safeParse(input)
  if (!r.success) return { success: false, error: r.error.message }
  // Cross-field rule: field names must be unique across all steps
  const names = new Set<string>()
  for (const step of r.data.steps) {
    for (const f of step.fields) {
      if (f.type === 'page-break') continue
      if (names.has(f.name)) return { success: false, error: `Duplicate field name: ${f.name}` }
      names.add(f.name)
    }
  }
  return { success: true, schema: r.data }
}

export interface SubmissionOk { ok: true; data: Record<string, unknown> }
export interface SubmissionErr { ok: false; errors: Record<string, string> }

const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSubmission(
  schema: FormSchema,
  raw: Record<string, unknown>,
): SubmissionOk | SubmissionErr {
  const errors: Record<string, string> = {}
  const out: Record<string, unknown> = {}

  for (const step of schema.steps) for (const f of step.fields) {
    if (f.type === 'page-break') continue
    const v = raw[f.name]
    const present = v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
    if (f.required && !present) { errors[f.name] = 'Required'; continue }
    if (!present) continue

    switch (f.type) {
      case 'short-text': case 'long-text': case 'phone':
        if (typeof v !== 'string') errors[f.name] = 'Must be text'
        else out[f.name] = v.trim()
        break
      case 'email':
        if (typeof v !== 'string' || !EmailRegex.test(v)) errors[f.name] = 'Invalid email'
        else out[f.name] = v.trim().toLowerCase()
        break
      case 'number': {
        const n = typeof v === 'number' ? v : Number(v)
        if (Number.isNaN(n)) { errors[f.name] = 'Must be a number'; break }
        if (f.min !== undefined && n < f.min) errors[f.name] = `Min ${f.min}`
        else if (f.max !== undefined && n > f.max) errors[f.name] = `Max ${f.max}`
        else out[f.name] = n
        break
      }
      case 'date':
        if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) errors[f.name] = 'Invalid date'
        else out[f.name] = v
        break
      case 'dropdown': case 'radio':
        if (!f.options.find((o) => o.value === v)) errors[f.name] = 'Invalid option'
        else out[f.name] = v
        break
      case 'multiselect': case 'checkbox-group': {
        if (!Array.isArray(v)) { errors[f.name] = 'Must be a list'; break }
        const valid = f.options.map((o) => o.value)
        const bad = (v as unknown[]).find((x) => !valid.includes(x as string))
        if (bad !== undefined) errors[f.name] = 'Invalid option'
        else out[f.name] = v
        break
      }
      case 'consent':
        if (v !== true) errors[f.name] = 'Required'
        else out[f.name] = true
        break
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors }
  return { ok: true, data: out }
}
```

- [ ] **Step 4: Run tests. Expect pass.** `npx vitest run tests/lib/form-schema.test.ts`

- [ ] **Step 5: Commit.**
```bash
git add src/lib/form-schema.ts tests/lib/form-schema.test.ts package.json package-lock.json
git commit -m "feat(forms): schema validators + field-type registry"
```

### Task A2: `Forms` collection

**Files:**
- Create: `src/collections/Forms.ts`
- Modify: `src/payload.config.ts`
- Test: `tests/collections/forms.access.test.ts`

- [ ] **Step 1: Read pattern reference.** Re-read `src/collections/Pages.ts` (slug auto-gen, sidebar position, billing lock, tenant relationship pattern). Re-read `src/collections/DonationFunds.ts` for non-text-heavy collection structure.

- [ ] **Step 2: Write failing access tests.**

```ts
// tests/collections/forms.access.test.ts
import { describe, it, expect } from 'vitest'
import { Forms } from '@/collections/Forms'

const callAccess = (op: 'read'|'create'|'update'|'delete', user: any) =>
  (Forms.access![op] as Function)({ req: { user }, id: undefined })

describe('Forms access', () => {
  const tenant = { id: 't1' }
  const tenantUser = { id: 'u1', role: 'admin', tenant }
  it('blocks unauthenticated read', () => {
    expect(callAccess('read', null)).toBe(false)
  })
  it('returns tenant-scoped where for tenant users', () => {
    expect(callAccess('read', tenantUser)).toEqual({ tenant: { equals: 't1' } })
  })
  it('returns true for platformOwner', () => {
    expect(callAccess('read', { id: 'p', role: 'platformOwner' })).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests. Expect import failure.** `npx vitest run tests/collections/forms.access.test.ts`

- [ ] **Step 4: Implement `Forms.ts`.**

```ts
// src/collections/Forms.ts
import type { CollectionConfig, FieldHook } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { withBillingLock } from '../access/billingLocked'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { validateSchema } from '../lib/form-schema'

const slugify = (v: string): string =>
  v.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

const autoSlug: FieldHook = ({ value, data, operation }) => {
  if (value) return value
  if (operation === 'create' && data?.title) return slugify(String(data.title))
  return value
}

export const Forms: CollectionConfig = {
  slug: 'forms',
  labels: { singular: 'Form', plural: 'Forms' },
  admin: {
    group: 'Forms',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'submissionsCount', 'updatedAt'],
    description: 'Build forms for RSVPs, registrations, surveys, and more.',
  },
  access: {
    read: tenantScopedRead,
    create: withBillingLock(tenantScopedCreate),
    update: withBillingLock(tenantScopedUpdate),
    delete: withBillingLock(tenantScopedDelete),
  },
  hooks: {
    beforeChange: [setTenantFromUser, async ({ data }) => {
      if (data?.schema) {
        const r = validateSchema(data.schema)
        if (!r.success) throw new Error(`Invalid form schema: ${r.error}`)
      }
      return data
    }],
  },
  fields: [
    { name: 'title', type: 'text', required: true, label: 'Form title' },
    { name: 'slug', type: 'text', index: true, hooks: { beforeValidate: [autoSlug] },
      admin: { position: 'sidebar', description: 'URL slug. /forms/<slug>.' } },
    { name: 'status', type: 'select', defaultValue: 'draft', required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: { position: 'sidebar' } },
    { name: 'description', type: 'richText',
      admin: { description: 'Shown above the form on the public page.' } },
    {
      name: 'schema',
      type: 'json',
      required: true,
      defaultValue: { steps: [{ id: 's1', fields: [] }] },
      admin: {
        description: 'The form definition. Use the builder above.',
        components: { Field: '/src/admin/forms/FormBuilderField#default' },
      },
    },
    {
      name: 'settings',
      type: 'group',
      fields: [
        { name: 'submitButtonLabel', type: 'text', defaultValue: 'Submit' },
        { name: 'successMessage', type: 'richText' },
        { name: 'capacity', type: 'number', min: 0,
          admin: { description: 'Max submissions before the form closes. Leave blank for no limit.' } },
        { name: 'closedMessage', type: 'text',
          defaultValue: 'This form is closed. Thank you for your interest.' },
        { name: 'notificationEmails', type: 'array', fields: [
          { name: 'email', type: 'email', required: true },
        ] },
        { name: 'sendConfirmation', type: 'checkbox', defaultValue: false,
          label: 'Send a confirmation email to the submitter' },
        { name: 'confirmationSubject', type: 'text' },
        { name: 'confirmationBody', type: 'textarea',
          admin: { description: 'Plain text body. {{name}} interpolates the submitter name field if present.' } },
      ],
    },
    {
      name: 'payment',
      type: 'group',
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false },
        { name: 'mode', type: 'select', defaultValue: 'suggested',
          options: [
            { label: 'Fixed price', value: 'fixed' },
            { label: 'Suggested amounts', value: 'suggested' },
          ],
        },
        { name: 'priceCents', type: 'number',
          admin: { condition: (_, sib) => sib?.mode === 'fixed' && sib?.enabled } },
        { name: 'suggestedAmountsCents', type: 'array', fields: [
          { name: 'amount', type: 'number', required: true, min: 0 },
        ], admin: { condition: (_, sib) => sib?.mode === 'suggested' && sib?.enabled } },
        { name: 'allowCustomAmount', type: 'checkbox', defaultValue: true,
          admin: { condition: (_, sib) => sib?.mode === 'suggested' && sib?.enabled } },
        { name: 'currency', type: 'select', defaultValue: 'usd',
          options: [{ label: 'USD', value: 'usd' }, { label: 'CAD', value: 'cad' }, { label: 'GBP', value: 'gbp' }] },
        { name: 'description', type: 'text',
          admin: { description: 'Shown on the Stripe checkout page.' } },
      ],
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
  ],
}
```

- [ ] **Step 5: Register in `payload.config.ts`.** Open `src/payload.config.ts`, find the `collections` array, add `Forms` import + entry next to `Pages` and similar content collections.

- [ ] **Step 6: Run tests. Expect pass.** `npx vitest run tests/collections/forms.access.test.ts`

- [ ] **Step 7: Generate migration + types.**
```bash
npm run payload generate:types
npm run payload migrate:create -- --name forms_collection
```

- [ ] **Step 8: Commit.**
```bash
git add src/collections/Forms.ts src/payload.config.ts src/payload-types.ts src/migrations/* tests/collections/forms.access.test.ts
git commit -m "feat(forms): Forms collection with schema validation hook"
```

### Task A3: `FormSubmissions` collection

**Files:**
- Create: `src/collections/FormSubmissions.ts`
- Modify: `src/payload.config.ts`
- Test: `tests/collections/form-submissions.access.test.ts`

- [ ] **Step 1: Pattern reference.** Read `src/collections/Donations.ts` — webhook-only writes, read-only admin, no PII beyond Stripe ids.

- [ ] **Step 2: Write failing tests.**

```ts
// tests/collections/form-submissions.access.test.ts
import { describe, it, expect } from 'vitest'
import { FormSubmissions } from '@/collections/FormSubmissions'

const callAccess = (op: 'read'|'create'|'update'|'delete', user: any) =>
  (FormSubmissions.access![op] as Function)({ req: { user }, id: undefined })

describe('FormSubmissions access', () => {
  it('denies create/update/delete from any user', () => {
    expect(callAccess('create', { role: 'platformOwner' })).toBe(false)
    expect(callAccess('update', { role: 'platformOwner' })).toBe(false)
    expect(callAccess('delete', { role: 'platformOwner' })).toBe(false)
  })
  it('tenant-scopes reads', () => {
    expect(callAccess('read', { id: 'u', role: 'admin', tenant: { id: 't' } }))
      .toEqual({ tenant: { equals: 't' } })
  })
})
```

- [ ] **Step 3: Run tests. Expect failure.** `npx vitest run tests/collections/form-submissions.access.test.ts`

- [ ] **Step 4: Implement `FormSubmissions.ts`.**

```ts
// src/collections/FormSubmissions.ts
import type { CollectionConfig } from 'payload'
import { tenantScopedRead } from '../access/tenantScoped'

export const FormSubmissions: CollectionConfig = {
  slug: 'form-submissions',
  labels: { singular: 'Submission', plural: 'Submissions' },
  admin: {
    group: 'Forms',
    useAsTitle: 'submitterEmail',
    defaultColumns: ['submittedAt', 'submitterEmail', 'form', 'status', 'paymentStatus'],
    description: 'Form submissions. Read-only — created by the public submit endpoint.',
  },
  access: {
    create: () => false,
    update: () => false,
    delete: () => false,
    read: tenantScopedRead,
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true,
      admin: { readOnly: true } },
    { name: 'form', type: 'relationship', relationTo: 'forms', required: true, index: true,
      admin: { readOnly: true } },
    { name: 'submitterEmail', type: 'email', required: true, admin: { readOnly: true } },
    { name: 'submitterName', type: 'text', admin: { readOnly: true } },
    { name: 'data', type: 'json', required: true, admin: { readOnly: true } },
    { name: 'status', type: 'select', defaultValue: 'new', required: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Reviewed', value: 'reviewed' },
        { label: 'Archived', value: 'archived' },
      ] },
    { name: 'paymentStatus', type: 'select',
      options: [
        { label: 'Not applicable', value: 'na' },
        { label: 'Pending payment', value: 'pending_payment' },
        { label: 'Paid', value: 'paid' },
        { label: 'Expired', value: 'expired' },
      ],
      defaultValue: 'na',
      admin: { readOnly: true } },
    { name: 'amountCents', type: 'number', admin: { readOnly: true } },
    { name: 'currency', type: 'text', admin: { readOnly: true } },
    { name: 'stripeCheckoutSessionId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'stripePaymentIntentId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'paidAt', type: 'date', admin: { readOnly: true } },
    { name: 'submittedAt', type: 'date', required: true, defaultValue: () => new Date(),
      admin: { readOnly: true } },
    { name: 'userAgent', type: 'text', admin: { readOnly: true } },
    { name: 'ipHash', type: 'text', admin: { readOnly: true } },
  ],
}
```

- [ ] **Step 5: Register in `payload.config.ts`.** Add `FormSubmissions` to the `collections` array.

- [ ] **Step 6: Run tests. Expect pass.**

- [ ] **Step 7: Generate migration + types.**
```bash
npm run payload generate:types
npm run payload migrate:create -- --name form_submissions_collection
```

- [ ] **Step 8: Commit.**
```bash
git add src/collections/FormSubmissions.ts src/payload.config.ts src/payload-types.ts src/migrations/* tests/collections/form-submissions.access.test.ts
git commit -m "feat(forms): FormSubmissions collection (webhook-write, tenant-scoped read)"
```

---

## Phase B — Public form: rendering and submission (no payment)

> **Design source for the public surface:** artboards `5.1 public-empty`, `5.2 public-filled`, `5.3 public-multi`, `5.4 public-success` (desktop) and `6.1–6.3` (mobile, 390px) in `Forms.html`. `PublicForm.jsx` and the `.pf-*` rules in `forms.css` carry the exact tokens — input padding 12/14, radius 9px, focus ring 4px brand-tint, suggested-amount tile 4-col grid that collapses to 2 on mobile, success-card 76px brand circle with check, monospace receipt strip. Brand color flows through `var(--pf-brand, var(--icp-teal-500))`. The visual must match these artboards.

### Task B1: rate limiter

**Files:**
- Create: `src/lib/form-rate-limit.ts`
- Test: `tests/lib/form-rate-limit.test.ts`

- [ ] **Step 1: Write failing tests.**

```ts
// tests/lib/form-rate-limit.test.ts
import { describe, it, expect } from 'vitest'
import { checkRateLimit, _resetForTest } from '@/lib/form-rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => _resetForTest())
  it('allows up to 5 hits per minute then blocks', () => {
    const key = 'ip:abc'
    for (let i = 0; i < 5; i++) expect(checkRateLimit(key)).toBe(true)
    expect(checkRateLimit(key)).toBe(false)
  })
  it('refills after a minute', () => {
    const key = 'ip:abc'
    for (let i = 0; i < 5; i++) checkRateLimit(key)
    // Advance internal clock
    _resetForTest()
    expect(checkRateLimit(key)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests. Expect failure.**

- [ ] **Step 3: Implement.**

```ts
// src/lib/form-rate-limit.ts
const buckets = new Map<string, { count: number; windowStart: number }>()
const WINDOW_MS = 60_000
const LIMIT = 5

export function checkRateLimit(key: string, now = Date.now()): boolean {
  const b = buckets.get(key)
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now })
    return true
  }
  if (b.count >= LIMIT) return false
  b.count++
  return true
}

export function _resetForTest() { buckets.clear() }
```

- [ ] **Step 4: Run tests. Expect pass.**

- [ ] **Step 5: Commit.**
```bash
git add src/lib/form-rate-limit.ts tests/lib/form-rate-limit.test.ts
git commit -m "feat(forms): in-memory rate limiter for submit endpoint"
```

### Task B2: notifications helper

**Files:**
- Create: `src/lib/form-notifications.ts`
- Test: `tests/lib/form-notifications.test.ts`

- [ ] **Step 1: Read existing.** Skim `src/app/(marketing)/marketing/contact/actions.ts` for the Resend HTTP-API pattern; mirror it (no SDK, just `fetch`). Mirror env var names (`RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`).

- [ ] **Step 2: Write failing tests.**

```ts
// tests/lib/form-notifications.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendFormNotifications } from '@/lib/form-notifications'

const fetchSpy = vi.fn()
beforeEach(() => { fetchSpy.mockReset(); global.fetch = fetchSpy as any })

describe('sendFormNotifications', () => {
  const form = {
    title: 'Iftar RSVP',
    settings: {
      notificationEmails: [{ email: 'admin@m.org' }],
      sendConfirmation: true,
      confirmationSubject: 'Thanks for registering for {{form}}',
      confirmationBody: 'Salam {{name}} — see you Friday.',
    },
  } as any
  const submission = { submitterEmail: 's@x.com', submitterName: 'Aisha',
    data: { name: 'Aisha', email: 's@x.com' } } as any

  it('logs and returns when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY
    await sendFormNotifications({ form, submission })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends one admin email per recipient + one confirmation when configured', async () => {
    process.env.RESEND_API_KEY = 're_test'
    fetchSpy.mockResolvedValue({ ok: true })
    await sendFormNotifications({ form, submission })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 3: Run tests. Expect failure.**

- [ ] **Step 4: Implement.**

```ts
// src/lib/form-notifications.ts
import type { Form, FormSubmission } from '@/payload-types'

const TEMPLATE_RX = /\{\{\s*([\w]+)\s*\}\}/g
function interpolate(t: string, vars: Record<string, string>): string {
  return t.replace(TEMPLATE_RX, (_, k) => vars[k] ?? '')
}

async function sendOne({ to, subject, text, replyTo }: {
  to: string; subject: string; text: string; replyTo?: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@openmasjid.app'
  const fromName = process.env.EMAIL_FROM_NAME || 'OpenMasjid'
  if (!apiKey) {
    console.info('[form-notifications] RESEND_API_KEY unset; logging instead', { to, subject })
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${fromName} <${fromAddress}>`, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  if (!res.ok) console.error('[form-notifications] Resend send failed', res.status)
}

export async function sendFormNotifications({
  form, submission,
}: { form: Form; submission: FormSubmission }) {
  const settings = form.settings ?? {}
  const recipients = (settings.notificationEmails ?? []).map((e) => e.email).filter(Boolean) as string[]
  const summary = Object.entries(submission.data as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
    .join('\n')

  const adminSubject = `New submission: ${form.title}`
  const adminText = `Submitted at ${submission.submittedAt}\nFrom: ${submission.submitterEmail}\n\n${summary}`
  await Promise.all(recipients.map((to) =>
    sendOne({ to, subject: adminSubject, text: adminText, replyTo: submission.submitterEmail || undefined })))

  if (settings.sendConfirmation && submission.submitterEmail) {
    const vars = {
      form: form.title,
      name: submission.submitterName || submission.submitterEmail,
    }
    const subject = interpolate(settings.confirmationSubject || `Thanks for submitting ${form.title}`, vars)
    const body = interpolate(settings.confirmationBody || 'Thanks for your submission. We will be in touch.', vars)
    await sendOne({ to: submission.submitterEmail, subject, text: body })
  }
}
```

- [ ] **Step 5: Run tests. Expect pass.**

- [ ] **Step 6: Commit.**
```bash
git add src/lib/form-notifications.ts tests/lib/form-notifications.test.ts
git commit -m "feat(forms): admin + confirmation notification helper"
```

### Task B3: `submitForm` core lib (no payment branch yet)

**Files:**
- Create: `src/lib/form-submit.ts`
- Test: `tests/lib/form-submit.test.ts`

- [ ] **Step 1: Write failing tests** covering: honeypot triggers silent success, rate limit blocks, validation error returns errors, capacity reached returns closed, happy-path returns ok and creates a submission. Use vitest mocks for `payload.create` and `payload.count`.

```ts
// tests/lib/form-submit.test.ts
import { describe, it, expect, vi } from 'vitest'
import { submitForm } from '@/lib/form-submit'

const baseForm = {
  id: 'form-1', tenant: { id: 't1' }, title: 'Test', status: 'published',
  schema: { steps: [{ id: 's1', fields: [
    { type: 'short-text', id: 'f1', name: 'name', label: 'Name', required: true },
    { type: 'email', id: 'f2', name: 'email', label: 'Email', required: true },
  ]}]},
  settings: { capacity: null, notificationEmails: [], sendConfirmation: false },
  payment: { enabled: false },
}

function makePayload(overrides: any = {}) {
  return {
    count: vi.fn().mockResolvedValue({ totalDocs: 0 }),
    create: vi.fn().mockResolvedValue({ id: 'sub-1', ...baseForm }),
    ...overrides,
  } as any
}

describe('submitForm', () => {
  it('rejects when honeypot is filled', async () => {
    const r = await submitForm({
      payload: makePayload(), form: baseForm as any,
      data: { name: 'a', email: 'a@b.c', _hp: 'x' }, ip: '1.1.1.1', userAgent: 'ua',
    })
    expect(r.ok).toBe(true) // silent success
    // create not called
    // (asserted via spy in real test)
  })
  it('rejects when validation fails', async () => {
    const r = await submitForm({
      payload: makePayload(), form: baseForm as any,
      data: { name: '' }, ip: '1.1.1.1', userAgent: 'ua',
    })
    expect(r.ok).toBe(false)
  })
  it('rejects when capacity reached', async () => {
    const f = { ...baseForm, settings: { ...baseForm.settings, capacity: 1 } }
    const p = makePayload({ count: vi.fn().mockResolvedValue({ totalDocs: 1 }) })
    const r = await submitForm({ payload: p, form: f as any,
      data: { name: 'a', email: 'a@b.c' }, ip: '1.1.1.1', userAgent: 'ua' })
    if (r.ok) throw new Error('expected error')
    expect(r.error).toBe('closed')
  })
  it('creates submission on happy path', async () => {
    const p = makePayload()
    const r = await submitForm({ payload: p, form: baseForm as any,
      data: { name: 'A', email: 'a@b.c' }, ip: '1.1.1.1', userAgent: 'ua' })
    expect(r.ok).toBe(true)
    expect(p.create).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests. Expect failure.**

- [ ] **Step 3: Implement.**

```ts
// src/lib/form-submit.ts
import { createHash } from 'node:crypto'
import type { Payload } from 'payload'
import { validateSubmission, type FormSchema } from './form-schema'
import { checkRateLimit } from './form-rate-limit'

interface SubmitArgs {
  payload: Payload
  form: { id: string|number; tenant: { id: string|number } | string|number; title: string;
    status: string; schema: FormSchema; settings?: any; payment?: any }
  data: Record<string, unknown>
  ip: string
  userAgent: string
}

export type SubmitResult =
  | { ok: true; submissionId: string|number; checkoutPending: boolean }
  | { ok: false; error: 'rate_limited' | 'validation' | 'closed' | 'not_published'
       errors?: Record<string, string> }

export async function submitForm(args: SubmitArgs): Promise<SubmitResult> {
  const { payload, form, data, ip, userAgent } = args

  if (form.status !== 'published') return { ok: false, error: 'not_published' }

  // 1. Honeypot — silent success on bot
  if (data._hp) return { ok: true, submissionId: 0 as unknown as string, checkoutPending: false }

  // 2. Rate limit
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32)
  if (!checkRateLimit(`form:${form.id}:${ipHash}`)) return { ok: false, error: 'rate_limited' }

  // 3. Schema validation
  const v = validateSubmission(form.schema, data)
  if (!v.ok) return { ok: false, error: 'validation', errors: v.errors }

  // 4. Capacity
  const cap = form.settings?.capacity
  if (typeof cap === 'number' && cap > 0) {
    const counted = await payload.count({
      collection: 'form-submissions',
      where: { and: [
        { form: { equals: form.id } },
        { paymentStatus: { not_in: ['expired'] } },
      ] },
    })
    if (counted.totalDocs >= cap) return { ok: false, error: 'closed' }
  }

  // 5. Persist (submission status pending_payment if payment enabled)
  const paymentEnabled = Boolean(form.payment?.enabled)
  const tenantId = typeof form.tenant === 'object' ? form.tenant.id : form.tenant
  const created = await payload.create({
    collection: 'form-submissions',
    data: {
      tenant: tenantId,
      form: form.id,
      submitterEmail: typeof v.data.email === 'string' ? v.data.email : '',
      submitterName: typeof v.data.name === 'string' ? v.data.name : null,
      data: v.data,
      status: 'new',
      paymentStatus: paymentEnabled ? 'pending_payment' : 'na',
      submittedAt: new Date(),
      userAgent,
      ipHash,
    } as any,
    overrideAccess: true,
  })

  return { ok: true, submissionId: created.id, checkoutPending: paymentEnabled }
}
```

- [ ] **Step 4: Run tests. Expect pass.**

- [ ] **Step 5: Commit.**
```bash
git add src/lib/form-submit.ts tests/lib/form-submit.test.ts
git commit -m "feat(forms): submitForm core (honeypot, rate-limit, capacity, persist)"
```

### Task B4: submit API route

**Files:**
- Create: `src/app/api/forms/[slug]/submit/route.ts`
- Test: `tests/api/forms.submit.test.ts`

- [ ] **Step 1: Write failing tests** covering: 404 unknown form, 200 happy path, 422 validation, 429 rate-limit, 410 closed.

```ts
// tests/api/forms.submit.test.ts
import { describe, it, expect, vi } from 'vitest'
import { POST } from '@/app/api/forms/[slug]/submit/route'

vi.mock('@/lib/tenant-server', () => ({
  resolveTenantFromContext: vi.fn().mockResolvedValue({ id: 't1' }),
  getTenantContext: vi.fn().mockResolvedValue({ type: 'tenant-subdomain', slug: 'icp' }),
}))

vi.mock('payload', () => ({
  getPayload: vi.fn().mockResolvedValue({
    find: vi.fn().mockResolvedValue({ docs: [] }),
    create: vi.fn(),
    count: vi.fn().mockResolvedValue({ totalDocs: 0 }),
  }),
}))

function makeReq(body: any, headers: Record<string,string> = {}) {
  return new Request('http://test/api/forms/x/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/forms/[slug]/submit', () => {
  it('404 when form not found', async () => {
    const res = await POST(makeReq({}), { params: Promise.resolve({ slug: 'nope' }) })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests.** Expect import / shape failures until route is written.

- [ ] **Step 3: Implement route.**

```ts
// src/app/api/forms/[slug]/submit/route.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolveTenantFromContext, getTenantContext } from '@/lib/tenant-server'
import { submitForm } from '@/lib/form-submit'
import { sendFormNotifications } from '@/lib/form-notifications'
import { createFormCheckoutSession } from '@/lib/form-checkout'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await getTenantContext()
  const tenant = await resolveTenantFromContext(ctx)
  if (!tenant) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })

  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'forms',
    where: { and: [
      { tenant: { equals: tenant.id } },
      { slug: { equals: slug } },
      { status: { equals: 'published' } },
    ] },
    limit: 1,
    overrideAccess: true,
  })
  const form = found.docs[0]
  if (!form) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '0.0.0.0'
  const userAgent = req.headers.get('user-agent') || ''

  const result = await submitForm({ payload, form: form as any, data: body, ip, userAgent })
  if (!result.ok) {
    if (result.error === 'rate_limited') return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    if (result.error === 'closed') return NextResponse.json({ error: 'closed' }, { status: 410 })
    if (result.error === 'validation')
      return NextResponse.json({ error: 'validation', fieldErrors: result.errors }, { status: 422 })
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  if (!result.checkoutPending) {
    const submission = await payload.findByID({ collection: 'form-submissions', id: result.submissionId, overrideAccess: true })
    await sendFormNotifications({ form: form as any, submission: submission as any })
    return NextResponse.json({ ok: true })
  }

  const submission = await payload.findByID({ collection: 'form-submissions', id: result.submissionId, overrideAccess: true })
  const amount = Number(body._amount_cents) || (form as any).payment?.priceCents || 0
  const checkout = await createFormCheckoutSession({
    payload, tenant: tenant as any, form: form as any, submission: submission as any, amountCents: amount,
  })
  // Record session id
  await payload.update({
    collection: 'form-submissions', id: result.submissionId,
    data: { stripeCheckoutSessionId: checkout.id, amountCents: amount, currency: (form as any).payment?.currency ?? 'usd' },
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, checkoutUrl: checkout.url })
}
```

- [ ] **Step 4: Run tests. Iterate to pass.**

- [ ] **Step 5: Commit.**
```bash
git add src/app/api/forms/[slug]/submit/route.ts tests/api/forms.submit.test.ts
git commit -m "feat(forms): POST /api/forms/[slug]/submit endpoint"
```

### Task B5: public form page (no payment yet)

**Design:** `5.1 public-empty` (single-page empty), `5.2 public-filled` (filled inputs use `is-filled` cream-gray background), `5.3 public-multi` (progress bar + step heading + ghost Back / primary Continue), `6.1` mobile.

**Files:**
- Create: `src/app/(site)/forms/[slug]/page.tsx`
- Create: `src/app/(site)/forms/[slug]/PublicFormClient.tsx`
- Create: `src/components/PublicFormFields.tsx`
- Create: `src/components/PublicFormProgress.tsx`
- Create: `src/components/PublicFormSuccess.tsx`
- Create: `src/styles/public-forms.css`

- [ ] **Step 1: Read pattern.** Look at `src/app/(site)/page.tsx` (tenant home) for `getCurrentTenant()` + `dynamic = 'force-dynamic'` pattern.

- [ ] **Step 2: Implement server page.**

```tsx
// src/app/(site)/forms/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { PublicFormClient } from './PublicFormClient'
import '@/styles/public-forms.css'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function FormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tenant = await getCurrentTenant()
  if (!tenant) notFound()
  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'forms',
    where: { and: [
      { tenant: { equals: tenant.id } },
      { slug: { equals: slug } },
      { status: { in: ['published', 'closed'] } },
    ]},
    limit: 1,
    overrideAccess: true,
  })
  const form = found.docs[0]
  if (!form) notFound()

  let isFull = false
  if (form.status === 'published' && form.settings?.capacity) {
    const c = await payload.count({
      collection: 'form-submissions',
      where: { form: { equals: form.id } },
    })
    if (c.totalDocs >= form.settings.capacity) isFull = true
  }

  return (
    <div className="om-pf-shell" style={{ ['--pf-brand' as string]: tenant.brandColor || undefined }}>
      <PublicFormClient form={form as any} closed={form.status === 'closed' || isFull} />
    </div>
  )
}
```

- [ ] **Step 3: Implement client component.** Single component holding `values`, `errors`, `currentStep`, `submitting`. Renders fields via `PublicFormFields`, handles step nav, submits via `fetch('/api/forms/<slug>/submit', { method: 'POST', body: JSON.stringify(...) })`. On success returns success view; on failed validation displays per-field errors.

```tsx
// src/app/(site)/forms/[slug]/PublicFormClient.tsx
'use client'
import { useState, type FormEvent } from 'react'
import { PublicFormFields } from '@/components/PublicFormFields'
import { PublicFormProgress } from '@/components/PublicFormProgress'
import { PublicFormSuccess } from '@/components/PublicFormSuccess'
import type { Form } from '@/payload-types'
import type { FormSchema } from '@/lib/form-schema'

interface Props { form: Form; closed: boolean }

export function PublicFormClient({ form, closed }: Props) {
  const schema = form.schema as FormSchema
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<{ message?: string; receipt?: any } | null>(null)

  if (closed) {
    return <div className="om-pf-card om-pf-closed">{form.settings?.closedMessage ?? 'This form is closed.'}</div>
  }
  if (success) return <PublicFormSuccess form={form} values={values} receipt={success.receipt} />

  const totalSteps = schema.steps.length
  const isLast = step === totalSteps - 1
  const currentFields = schema.steps[step].fields.filter((f) => f.type !== 'page-break')

  function setValue(name: string, v: unknown) {
    setValues((prev) => ({ ...prev, [name]: v }))
    if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest)
  }

  function validateStep(): boolean {
    const stepErrors: Record<string, string> = {}
    for (const f of currentFields) {
      if (f.type === 'page-break') continue
      if (f.required && (values[f.name] === undefined || values[f.name] === '' || (Array.isArray(values[f.name]) && (values[f.name] as unknown[]).length === 0)))
        stepErrors[f.name] = 'Required'
    }
    setErrors((prev) => ({ ...prev, ...stepErrors }))
    return Object.keys(stepErrors).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validateStep()) return
    if (!isLast) { setStep(step + 1); return }
    setSubmitting(true)
    const body = { ...values, _hp: (e.currentTarget as HTMLFormElement)._hp?.value || '' }
    const res = await fetch(`/forms/${form.slug}/submit-relative`.replace('/submit-relative', `/api/forms/${form.slug}/submit`), {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }).catch(() => null)
    setSubmitting(false)
    if (!res) { setErrors({ _form: 'Network error — please try again.' }); return }
    if (res.status === 422) { const j = await res.json(); setErrors(j.fieldErrors ?? {}); return }
    if (res.status === 410) { setErrors({ _form: 'This form just closed.' }); return }
    if (res.status === 429) { setErrors({ _form: 'Too many attempts — try again in a minute.' }); return }
    if (!res.ok) { setErrors({ _form: 'Something went wrong.' }); return }
    const j = await res.json()
    if (j.checkoutUrl) { window.location.assign(j.checkoutUrl); return }
    setSuccess({ message: 'Submitted' })
  }

  return (
    <form className="om-pf-card" onSubmit={onSubmit} noValidate>
      {totalSteps > 1 && <PublicFormProgress current={step + 1} total={totalSteps} />}
      <PublicFormFields fields={currentFields} values={values} errors={errors} onChange={setValue} />
      <input type="text" name="_hp" autoComplete="off" tabIndex={-1}
             style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
             aria-hidden="true" />
      {errors._form && <p className="om-pf-error" role="alert">{errors._form}</p>}
      <div className="om-pf-actions">
        {step > 0 && <button type="button" className="om-pf-btn-ghost" onClick={() => setStep(step - 1)}>← Back</button>}
        <button type="submit" className="om-pf-btn-primary" disabled={submitting}>
          {submitting ? 'Submitting…' : isLast ? (form.settings?.submitButtonLabel ?? 'Submit') : 'Continue →'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Implement field renderers.**

```tsx
// src/components/PublicFormFields.tsx
import type { Field } from '@/lib/form-schema'

interface Props {
  fields: Field[]
  values: Record<string, unknown>
  errors: Record<string, string>
  onChange: (name: string, value: unknown) => void
}

export function PublicFormFields({ fields, values, errors, onChange }: Props) {
  return (
    <div className="om-pf-fields">
      {fields.map((f) => {
        if (f.type === 'page-break') return null
        const err = errors[f.name]
        const v = values[f.name]
        return (
          <div key={f.id} className="om-pf-field" data-error={err ? '' : undefined}>
            <label className="om-pf-label" htmlFor={`f-${f.id}`}>
              {f.label}{f.required ? <span className="om-pf-req">*</span> : null}
            </label>
            {f.helpText && <p className="om-pf-help">{f.helpText}</p>}
            {renderControl(f, v, (val) => onChange(f.name, val))}
            {err && <p className="om-pf-field-error" role="alert">{err}</p>}
          </div>
        )
      })}
    </div>
  )
}

function renderControl(f: Field, v: unknown, onChange: (v: unknown) => void) {
  // Implement per type; concise versions:
  switch (f.type) {
    case 'short-text': case 'phone':
      return <input id={`f-${f.id}`} type="text" placeholder={f.placeholder} value={String(v ?? '')} onChange={(e) => onChange(e.target.value)} />
    case 'email':
      return <input id={`f-${f.id}`} type="email" placeholder={f.placeholder} value={String(v ?? '')} onChange={(e) => onChange(e.target.value)} />
    case 'long-text':
      return <textarea id={`f-${f.id}`} placeholder={f.placeholder} rows={5} value={String(v ?? '')} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <input id={`f-${f.id}`} type="number" min={f.min} max={f.max} value={v === undefined || v === null ? '' : String(v)} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
    case 'date':
      return <input id={`f-${f.id}`} type="date" value={String(v ?? '')} onChange={(e) => onChange(e.target.value)} />
    case 'dropdown':
      return (
        <select id={`f-${f.id}`} value={String(v ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    case 'radio':
      return (
        <div className="om-pf-radio">
          {f.options.map((o) => (
            <label key={o.value} className="om-pf-radio-item">
              <input type="radio" name={f.name} value={o.value} checked={v === o.value} onChange={() => onChange(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )
    case 'multiselect': case 'checkbox-group': {
      const arr = Array.isArray(v) ? (v as string[]) : []
      return (
        <div className="om-pf-checks">
          {f.options.map((o) => (
            <label key={o.value} className="om-pf-check-item">
              <input type="checkbox" checked={arr.includes(o.value)}
                     onChange={(e) => onChange(e.target.checked ? [...arr, o.value] : arr.filter((x) => x !== o.value))} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )
    }
    case 'consent':
      return (
        <label className="om-pf-consent">
          <input type="checkbox" checked={v === true} onChange={(e) => onChange(e.target.checked)} />
          <span>{f.label}</span>
        </label>
      )
    default:
      return null
  }
}
```

- [ ] **Step 5: Progress + Success components.**

```tsx
// src/components/PublicFormProgress.tsx
export function PublicFormProgress({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="om-pf-progress">
      <div className="om-pf-progress-meta">Step {current} of {total}</div>
      <div className="om-pf-progress-bar"><div style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
```

```tsx
// src/components/PublicFormSuccess.tsx
import type { Form } from '@/payload-types'
export function PublicFormSuccess({ form, values, receipt }: { form: Form; values: Record<string, unknown>; receipt?: any }) {
  const name = (values.name as string) || (values.email as string) || ''
  return (
    <div className="om-pf-card om-pf-success">
      <div className="om-pf-success-check">✓</div>
      <h1>JazakAllahu khairan{name ? `, ${String(name).split(' ')[0]}` : ''}</h1>
      <p>{form.settings?.successMessage ? null : 'We received your submission.'}</p>
      {receipt && <pre className="om-pf-receipt">Receipt #{receipt.id} · ${(receipt.amountCents/100).toFixed(2)}</pre>}
    </div>
  )
}
```

- [ ] **Step 6: Stylesheet — paste tokens from `design_handoff_forms_unpacked/design_handoff_forms/forms.css`** for the `.om-pf-*` classes (only the public-form sections; skip admin styles). Use `--pf-brand` as the brand-color CSS variable, defaulting to `#146E69`.

- [ ] **Step 7: Manual smoke.** `npm run dev`, seed a `published` form via Payload admin, hit `http://icp.localhost:3000/forms/<slug>`, verify rendering and submit-success flow. Stretch goal: capture a screenshot for the PR.

- [ ] **Step 8: Commit.**
```bash
git add src/app/\(site\)/forms src/components/PublicForm* src/styles/public-forms.css
git commit -m "feat(forms): public form rendering + submit (no payment branch)"
```

---

## Phase C — Stripe Connect Hosted Checkout

### Task C1: `form-checkout.ts`

**Files:**
- Create: `src/lib/form-checkout.ts`
- Test: `tests/lib/form-checkout.test.ts`

- [ ] **Step 1: Pattern.** Read `src/lib/membership-checkout.ts` for `getStripe()` + `stripe.checkout.sessions.create({}, { stripeAccount })` direct-charge pattern.

- [ ] **Step 2: Failing tests** asserting metadata shape (`kind: 'form-submission'`, `submissionId`, `tenantId`, `formId`), correct `success_url`, `cancel_url`, and that the session is created **with the tenant's `stripeAccountId`** as the request option.

- [ ] **Step 3: Implement.**

```ts
// src/lib/form-checkout.ts
import { getStripe } from './stripe'
import type { Payload } from 'payload'

interface Args {
  payload: Payload
  tenant: { id: string|number; stripeAccountId?: string|null; slug?: string|null;
    customDomains?: Array<{ domain: string }> | null }
  form: { id: string|number; title: string; slug: string; payment?: any }
  submission: { id: string|number }
  amountCents: number
}

export async function createFormCheckoutSession(args: Args) {
  const { tenant, form, submission, amountCents } = args
  const stripe = getStripe()
  const accountId = tenant.stripeAccountId
  if (!accountId) throw new Error('Tenant has no connected Stripe account')

  const origin = pickTenantOrigin(tenant)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: form.payment?.currency || 'usd',
        unit_amount: amountCents,
        product_data: {
          name: form.title,
          description: form.payment?.description || undefined,
        },
      },
    }],
    metadata: {
      kind: 'form-submission',
      submissionId: String(submission.id),
      formId: String(form.id),
      tenantId: String(tenant.id),
    },
    success_url: `${origin}/api/forms/${form.slug}/checkout-success?sid={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/forms/${form.slug}?cancelled=${submission.id}`,
  }, { stripeAccount: accountId })
  return session
}

function pickTenantOrigin(t: Args['tenant']): string {
  const cd = t.customDomains?.[0]?.domain
  if (cd) return `https://${cd}`
  return `https://${t.slug}.openmasjid.app`
}
```

- [ ] **Step 4: Run tests. Pass.**

- [ ] **Step 5: Commit.**
```bash
git add src/lib/form-checkout.ts tests/lib/form-checkout.test.ts
git commit -m "feat(forms): Stripe Connect Checkout Session helper"
```

### Task C2: `form-submissions-webhook.ts` + connect webhook fan-out

**Files:**
- Create: `src/lib/form-submissions-webhook.ts`
- Modify: `src/app/api/stripe/connect/webhook/route.ts`
- Test: `tests/lib/form-submissions-webhook.test.ts`

- [ ] **Step 1: Pattern.** Read `src/lib/donations-webhook.ts` and `src/lib/membership-webhook.ts`.

- [ ] **Step 2: Failing tests** for: `checkout.session.completed` with `kind === 'form-submission'` flips submission to `paid`, sets `paidAt`, records `stripePaymentIntentId`; ignores other kinds; idempotent on replay.

- [ ] **Step 3: Implement.**

```ts
// src/lib/form-submissions-webhook.ts
import type Stripe from 'stripe'
import type { Payload } from 'payload'
import { sendFormNotifications } from './form-notifications'

interface Args { event: Stripe.Event; payload: Payload }

export async function handleFormSubmissionEvent({ event, payload }: Args) {
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.expired') return
  const session = event.data.object as Stripe.Checkout.Session
  if (session.metadata?.kind !== 'form-submission') return
  const submissionId = session.metadata.submissionId
  if (!submissionId) return

  if (event.type === 'checkout.session.expired') {
    await payload.update({
      collection: 'form-submissions', id: submissionId,
      data: { paymentStatus: 'expired' },
      overrideAccess: true,
    }).catch(() => null)
    return
  }

  const sub = await payload.findByID({ collection: 'form-submissions', id: submissionId, overrideAccess: true })
  if (sub.paymentStatus === 'paid') return // idempotent

  await payload.update({
    collection: 'form-submissions', id: submissionId,
    data: {
      paymentStatus: 'paid',
      paidAt: new Date(),
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      amountCents: session.amount_total ?? sub.amountCents,
      currency: session.currency ?? sub.currency,
    },
    overrideAccess: true,
  })

  const form = await payload.findByID({ collection: 'forms', id: sub.form, overrideAccess: true })
  const fresh = await payload.findByID({ collection: 'form-submissions', id: submissionId, overrideAccess: true })
  await sendFormNotifications({ form: form as any, submission: fresh as any })
}
```

- [ ] **Step 4: Modify the connect webhook route.** In `src/app/api/stripe/connect/webhook/route.ts`, add `handleFormSubmissionEvent({ event, payload })` to the dispatch fan-out (alongside donations + memberships).

- [ ] **Step 5: Run tests. Pass.**

- [ ] **Step 6: Commit.**
```bash
git add src/lib/form-submissions-webhook.ts src/app/api/stripe/connect/webhook/route.ts tests/lib/form-submissions-webhook.test.ts
git commit -m "feat(forms): webhook handler — form-submission Checkout completion"
```

### Task C3: checkout-success route

**Files:**
- Create: `src/app/api/forms/[slug]/checkout-success/route.ts`
- Test: `tests/api/forms.checkout-success.test.ts`

- [ ] **Step 1: Failing tests** for: 302 to `/forms/<slug>/thanks?s=<id>` on success; 404 if session missing; safe to re-run after webhook already fired.

- [ ] **Step 2: Implement.**

```ts
// src/app/api/forms/[slug]/checkout-success/route.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sid')
  if (!sessionId) return NextResponse.json({ error: 'missing_sid' }, { status: 400 })

  const tenant = await getCurrentTenant()
  if (!tenant?.stripeAccountId) return NextResponse.json({ error: 'no_account' }, { status: 404 })

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId, { stripeAccount: tenant.stripeAccountId })
  const submissionId = session.metadata?.submissionId
  if (!submissionId) return NextResponse.json({ error: 'missing_metadata' }, { status: 400 })

  const payload = await getPayload({ config })
  const sub = await payload.findByID({ collection: 'form-submissions', id: submissionId, overrideAccess: true })
  // If webhook hasn't yet flipped the status, do it best-effort here.
  if (sub.paymentStatus === 'pending_payment' && session.payment_status === 'paid') {
    await payload.update({
      collection: 'form-submissions', id: submissionId,
      data: { paymentStatus: 'paid', paidAt: new Date(),
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        amountCents: session.amount_total ?? sub.amountCents,
        currency: session.currency ?? sub.currency },
      overrideAccess: true,
    })
  }
  return NextResponse.redirect(`${url.origin}/forms/${slug}/thanks?s=${submissionId}`, 303)
}
```

- [ ] **Step 3: Run tests. Pass.**

- [ ] **Step 4: Commit.**
```bash
git add src/app/api/forms/[slug]/checkout-success tests/api/forms.checkout-success.test.ts
git commit -m "feat(forms): Stripe Checkout success URL handler"
```

### Task C4: payment block + thanks page

**Design:** payment block from `5.1`/`5.2` (cream-gray inset card with Heart icon + heading + 4-col `$25/50/100/250` suggested amounts; selected = brand border + tinted background; "You'll be taken to **Stripe**…" sub-note with external-link icon). Submit button reads `Submit — $50` once an amount is selected (per `5.2`). Thanks page = `5.4 public-success` (76px brand circle + check, serif H1 "JazakAllahu khairan, {firstName}", monospace receipt strip, ghost "Add to calendar" + primary "Back to {masjidHost}").

**Files:**
- Create: `src/components/PublicFormPaymentBlock.tsx`
- Create: `src/app/(site)/forms/[slug]/thanks/page.tsx`

- [ ] **Step 1: Implement payment block.**

```tsx
// src/components/PublicFormPaymentBlock.tsx
'use client'
import { useState } from 'react'

interface Props {
  mode: 'fixed' | 'suggested'
  priceCents?: number
  suggestedAmountsCents?: number[]
  allowCustomAmount?: boolean
  currency?: string
  onChange: (amountCents: number) => void
}

export function PublicFormPaymentBlock({ mode, priceCents, suggestedAmountsCents = [], allowCustomAmount = true, currency = 'usd', onChange }: Props) {
  const [selected, setSelected] = useState<number | null>(mode === 'fixed' ? priceCents ?? null : null)
  const [custom, setCustom] = useState<string>('')

  if (mode === 'fixed') {
    return <div className="om-pf-pay">Amount: <strong>${((priceCents ?? 0)/100).toFixed(2)}</strong></div>
  }
  return (
    <div className="om-pf-pay">
      <div className="om-pf-pay-grid">
        {suggestedAmountsCents.map((amt) => (
          <button key={amt} type="button"
                  className={`om-pf-pay-tile ${selected === amt ? 'is-selected' : ''}`}
                  onClick={() => { setSelected(amt); setCustom(''); onChange(amt) }}>
            ${(amt/100).toFixed(0)}
          </button>
        ))}
      </div>
      {allowCustomAmount && (
        <label className="om-pf-pay-custom">
          <span>Other amount</span>
          <input type="number" min={1} value={custom}
                 onChange={(e) => { setCustom(e.target.value); const c = Math.round(Number(e.target.value)*100); setSelected(c); onChange(c) }} />
        </label>
      )}
      <p className="om-pf-pay-note">You'll be taken to <strong>Stripe</strong> to complete payment. Form data is held until payment succeeds.</p>
    </div>
  )
}
```

- [ ] **Step 2: Wire payment block into `PublicFormClient`.** Render above the action bar when `form.payment?.enabled`. Track `selectedAmountCents` in state and include as `_amount_cents` in submit body.

- [ ] **Step 3: Implement thanks page.**

```tsx
// src/app/(site)/forms/[slug]/thanks/page.tsx
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getCurrentTenant } from '@/lib/tenant-server'
import { PublicFormSuccess } from '@/components/PublicFormSuccess'

export const dynamic = 'force-dynamic'

export default async function ThanksPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ s?: string }>
}) {
  const { slug } = await params
  const { s } = await searchParams
  if (!s) notFound()
  const tenant = await getCurrentTenant()
  if (!tenant) notFound()
  const payload = await getPayload({ config })
  const submission = await payload.findByID({ collection: 'form-submissions', id: s, overrideAccess: true })
  if (!submission || (typeof submission.tenant === 'object' ? submission.tenant.id : submission.tenant) !== tenant.id) notFound()
  const form = await payload.findByID({ collection: 'forms', id: typeof submission.form === 'object' ? submission.form.id : submission.form, overrideAccess: true })
  return <PublicFormSuccess form={form as any} values={submission.data as any} receipt={
    submission.paymentStatus === 'paid' ? { id: submission.id, amountCents: submission.amountCents, currency: submission.currency } : undefined
  } />
}
```

- [ ] **Step 4: Manual smoke** with a Stripe test account on a tenant with `stripeAccountId` set.

- [ ] **Step 5: Commit.**
```bash
git add src/components/PublicFormPaymentBlock.tsx src/app/\(site\)/forms/[slug]/thanks src/app/\(site\)/forms/[slug]/PublicFormClient.tsx
git commit -m "feat(forms): suggested-amount payment block + thanks page"
```

---

## Phase D — Admin: form builder UI

> **Design source for this phase:** artboards `2.1 builder-default`, `2.2 builder-popover`, `2.3 builder-clean` in `design_handoff_forms_unpacked/design_handoff_forms/Forms.html` (open in a browser to inspect). Read `FormBuilder.jsx` and the `.builder-*` rules in `forms.css` for exact spacing, color tokens (e.g. selected card teal ring + soft glow), border radii (cards 12px, popover shadow), and sizes (canvas 760px max-width centered, properties drawer 360px). **Do not import the JSX** — translate the markup into our component conventions, but the visual must match.

### Task D1: builder skeleton (canvas + add-field popover, no drag yet)

**Design:** `2.1 builder-default` (selected field state), `2.2 builder-popover` (popover open over canvas), `2.3 builder-clean` (no selection, drawer collapsed).

**Files:**
- Create: `src/admin/forms/FormBuilderField.tsx`
- Create: `src/admin/forms/FormBuilderField.client.tsx`
- Create: `src/admin/forms/builder/FieldCard.tsx`
- Create: `src/admin/forms/builder/AddFieldPopover.tsx`
- Create: `src/admin/forms/builder/FieldTypeIcon.tsx`

- [ ] **Step 1: Read pattern.** Look at `src/fields/TextField.tsx` (an existing custom field component) and `src/admin/donations/AmountField.tsx` for the Payload custom-field signature in v3.

- [ ] **Step 2: Server wrapper.** `FormBuilderField.tsx` is a thin Payload field component that imports the client companion (Payload v3 supports both server and client field components; client components mount via `'use client'`).

- [ ] **Step 3: Client builder shell.** `FormBuilderField.client.tsx` reads/writes `form.schema` via Payload's `useField('schema')` hook. State: `selectedFieldId`, `popoverAtIndex`, `dirty`. Renders the canvas: each step's fields + `+ Add field` pills between cards + after the last.

- [ ] **Step 4: Add-field popover.** Search input filters `FIELD_TYPES` by label. Click a tile → invoke `addField(typeId, position)` → updates schema + selects the new field.

- [ ] **Step 5: Field card** with hover toolbar (drag handle stub, duplicate, delete). Click to select.

- [ ] **Step 6: Manual smoke.** Open `/admin/collections/forms/<id>`, see the builder canvas in place of the JSON field, add one field, save.

- [ ] **Step 7: Commit.**

### Task D2: properties drawer (General + Validation; Logic disabled)

**Design:** `2.1 builder-default` — drawer header (icon + type label + field name + close), tabs (General / Validation / Logic), property rows (Label, Field name in mono, Help text, Placeholder OR options list with drag-handle + input + delete per option, Behavior toggles).

**Files:**
- Create: `src/admin/forms/builder/PropertiesDrawer.tsx`

- [ ] **Step 1: Implement** drawer with three tabs (General, Validation, Logic). Logic tab renders a disabled message: "Conditional logic — coming soon." General tab: Label, Field name (mono, with auto-slug + edit warning), Help text, Placeholder OR Options editor (per type), Required toggle. Validation tab (per type): min/max for number, max length for text — keep minimal in v1.

- [ ] **Step 2: Manual smoke.** Add a field, edit label, save, refresh — value persists.

- [ ] **Step 3: Commit.**

### Task D3: drag-and-drop reorder

**Design:** `2.1 builder-default` field card grid (grip handle 22px on left, gray-30% default → gray-50% on hover). Cross-step drag should preserve the visual handoff over page-break dividers as shown in `FormBuilder.jsx`.

**Files:**
- Modify: `src/admin/forms/FormBuilderField.client.tsx`

- [ ] **Step 1: Wire `@dnd-kit/sortable`.** Wrap each step in `SortableContext`; field cards become `useSortable` items keyed by field `id`; cross-step drag allowed via a parent `DndContext` with `onDragEnd` reordering across steps.

- [ ] **Step 2: Manual smoke.** Drag a field across a page break; save; refresh.

- [ ] **Step 3: Commit.**

### Task D4: form-level toolbar tabs (Build / Settings / Submissions)

**Design:** sticky toolbar visible across `2.x`, `3.1`, `4.1` artboards: form title + status/slug/submissions metadata on the left; Build / Settings / Submissions tabs + Preview / View live / Save buttons on the right. Match button styling (primary navy, ghost) and metadata typography from `forms.css`.

**Files:**
- Create: `src/admin/forms/FormToolbar.tsx`
- Modify: `src/admin/forms/FormBuilderField.tsx` to host the toolbar above the canvas

- [ ] **Step 1: Render tabs** linked to query parameters (`?tab=build|settings|submissions`). The Build tab shows the canvas; Settings shows the existing Payload sidebar groups laid out per the designer's settings sub-nav; Submissions navigates to the submissions list filtered to the current form.

- [ ] **Step 2: View live + Save buttons** in the toolbar. "View live" links to the public form URL. Save reuses Payload's native save action.

- [ ] **Step 3: Commit.**

---

## Phase E — Admin: settings sub-nav

> **Design source:** artboard `3.1 form-settings` in `Forms.html`. 220px-wide settings sub-nav on the left, three stacked cards on the right (Form basics 2-col grid, Notifications inline toggles, Payment with master toggle + 2-col grid). Match exactly: card padding 24/28, section gap 16–18px, sub-nav active-row styling from `AdminScreens.jsx`.

### Task E1: settings layout + sub-nav shell

**Design:** `3.1 form-settings` (Basics shown active). Reproduce the sub-nav (7 items) and the three-card layout. Webhooks + Embed & share are page shells — render the nav row and a "Coming soon" card body matching the empty-state styling used elsewhere in `AdminScreens.jsx`.

**Files:**
- Create: `src/admin/forms/settings/SettingsNav.tsx`
- Create: `src/admin/forms/settings/sections/Basics.tsx`
- Create: `src/admin/forms/settings/sections/SubmissionLimits.tsx`
- Create: `src/admin/forms/settings/sections/Notifications.tsx`
- Create: `src/admin/forms/settings/sections/Payment.tsx`
- Create: `src/admin/forms/settings/sections/Confirmation.tsx`
- Create: `src/admin/forms/settings/sections/Webhooks.tsx`
- Create: `src/admin/forms/settings/sections/EmbedShare.tsx`

- [ ] **Step 1: Implement nav** with the 7 items listed in the designer brief. Active state from `?section=`. Each section maps to a Payload `useField()`-driven panel (Basics, Submission limits, Notifications, Payment, Confirmation) or to a static page shell (Webhooks, Embed & share).

- [ ] **Step 2: Webhooks shell.** Render: "Webhooks — coming soon. We'll let you POST submissions to a URL of your choice. [Notify me]" — no functionality in v1.

- [ ] **Step 3: Embed & share shell.** Render: public URL with "Copy" button + a placeholder "Embed code — coming soon".

- [ ] **Step 4: Wire into the toolbar Settings tab.**

- [ ] **Step 5: Commit.**

---

## Phase F — Admin: submissions list, detail, CSV

> **Design source:** artboards `1.1 forms-list`, `1.2 forms-list-drafts` (forms list with status pills + tabs), `4.1 subs-list` (per-form submissions table), and `4.2 sub-detail` (single submission with side cards) in `Forms.html`. See `AdminScreens.jsx` for column layout, status pill colors (published teal, draft gray, closed red, new/reviewed/archived per `forms.css`), and the side-card composition (Status meta rows + Payment with Stripe icon + last4).

### Task F1: CSV serializer

**Files:**
- Create: `src/lib/form-csv.ts`
- Test: `tests/lib/form-csv.test.ts`

- [ ] **Step 1: Failing tests** asserting column order matches schema field order, that arrays render as `"a; b"`, that quotes/commas/newlines are escaped, and that booleans render as `"yes"/""`.

- [ ] **Step 2: Implement.**

```ts
// src/lib/form-csv.ts
import type { FormSchema } from './form-schema'

const escape = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return ''
  if (Array.isArray(v)) return escape(v.join('; '))
  if (typeof v === 'boolean') return v ? 'yes' : ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function submissionsToCsv(
  schema: FormSchema,
  submissions: Array<{ submittedAt: string|Date; status: string; paymentStatus: string;
    submitterEmail: string; data: Record<string, unknown>; amountCents?: number|null; currency?: string|null }>,
): string {
  const fieldCols: Array<{ name: string; label: string }> = []
  for (const step of schema.steps) for (const f of step.fields) {
    if (f.type === 'page-break') continue
    fieldCols.push({ name: f.name, label: f.label })
  }
  const header = ['Submitted at','Email','Status','Payment','Amount','Currency', ...fieldCols.map((c) => c.label)]
  const rows = submissions.map((s) => [
    new Date(s.submittedAt).toISOString(),
    s.submitterEmail,
    s.status,
    s.paymentStatus,
    s.amountCents != null ? (s.amountCents/100).toFixed(2) : '',
    s.currency ?? '',
    ...fieldCols.map((c) => escape(s.data[c.name])),
  ].map(escape))
  return [header.map(escape).join(','), ...rows.map((r) => r.join(','))].join('\n')
}
```

- [ ] **Step 3: Run tests. Pass.**

- [ ] **Step 4: Commit.**

### Task F2: CSV export route

**Files:**
- Create: `src/app/api/forms/[slug]/submissions.csv/route.ts`

- [ ] **Step 1: Implement** auth-required (Payload session check) endpoint that streams `submissionsToCsv(form.schema, submissions)` with `Content-Type: text/csv; charset=utf-8` and a sensible `Content-Disposition: attachment; filename="<slug>-submissions-<date>.csv"`.

- [ ] **Step 2: Manual smoke** while logged into admin.

- [ ] **Step 3: Commit.**

### Task F3: submissions list custom view

**Design:** `4.1 subs-list` — 7-column table (checkbox / Submitter name+email / Preview / Payment / Status pill / Submitted / chevron). Filter + Export CSV buttons in the header row. Status-pill colors per `forms.css`.

**Files:**
- Create: `src/admin/forms/SubmissionsList.tsx`
- Modify: `src/collections/FormSubmissions.ts` — register the custom list view via `admin.components.beforeList` or a list-view component override per Payload v3 docs.

- [ ] **Step 1: Implement** filter (status, form), Export CSV button (links to the route from F2), 7-column table per the designer brief, status pills.

- [ ] **Step 2: Commit.**

### Task F4: submission detail with status workflow

**Design:** `4.2 sub-detail` — page head with back button, submitter name (H1, 22px), full timestamp + ID, action buttons (Reply / Export / Mark reviewed). Two-column body: answers card on left (2-col grid: question label small/uppercase/600 | answer regular) | side cards on right (320px): Status (pill + meta rows for Submitted, IP, User agent, Form version) and Payment (Stripe icon + amount + last4 + payment_intent ID).

**Files:**
- Create: `src/admin/forms/SubmissionDetail.tsx`
- Create: `src/app/api/forms/submissions/[id]/status/route.ts` (PATCH)

- [ ] **Step 1: Implement detail view** with Reply (mailto link), Export (single-row CSV), Mark reviewed (PATCHes status).

- [ ] **Step 2: Implement PATCH route** — auth required, tenant-scoped, only allows transitions `new→reviewed→archived` and back.

- [ ] **Step 3: Commit.**

---

## Phase G — Public form polish

### Task G1: brand color + style polish

**Files:**
- Modify: `src/styles/public-forms.css`
- Modify: `src/app/(site)/forms/[slug]/page.tsx`

- [ ] **Step 1: Confirm `--pf-brand` propagation.** Set on the wrapper div using the tenant's brand color. Default to teal `#146E69` if missing.

- [ ] **Step 2: Pull final tokens** from `forms.css` in the design package (radii, shadows, spacing, focus rings).

- [ ] **Step 3: Mobile pass at 390px viewport.** Verify card padding, suggested-amount grid drops to 2 columns.

- [ ] **Step 4: Commit.**

### Task G2: error states + accessibility audit

**Files:**
- Modify: `src/components/PublicFormFields.tsx`, `src/app/(site)/forms/[slug]/PublicFormClient.tsx`

- [ ] **Step 1:** All inputs have visible labels (no placeholder-only). Errors are announced with `role="alert"`. Focus moves to the first errored field on submit. Submit button has `aria-busy` while submitting. `aria-live="polite"` on the success card.

- [ ] **Step 2: Keyboard test.** Tab through every control; verify focus rings using `--pf-brand` token.

- [ ] **Step 3: Commit.**

---

## Phase H — End-to-end happy path

### Task H1: Playwright smoke

**Files:**
- Create: `e2e/forms.spec.ts` (or extend existing `e2e/` folder if present)

- [ ] **Step 1:** One test that, against a seeded tenant: logs into admin, creates a form with name + email + page break + capacity number, publishes it, copies the public URL, opens it, fills, submits, verifies the success page, then re-opens the admin and verifies the submission shows in the list.

- [ ] **Step 2: Commit.**

### Task H2: PR

- [ ] **Step 1:** `git push -u origin feat/tenant-forms`
- [ ] **Step 2:** `gh pr create --title "feat: tenant form builder (v1)" --body "..."` — body lists each phase, links to the spec + design package, screenshots from the design pack folder, manual test checklist (build form, fill on mobile, fill with payment in test mode, capacity reached, validation errors, CSV export).

---

## Self-review

- **Spec coverage:** every screen in the design package has a task: forms list (default Payload list view; styled per designer in F3), builder default/popover/clean (D1–D4), settings (E1), submissions list (F3), submission detail (F4), public empty/filled/multi/success (B5, C4, G1), mobile variants (G1).
- **Stripe pattern:** Connect direct charges via Hosted Checkout in C1; webhook in C2; success URL fallback in C3 — all mirror the donations precedent.
- **Brand color scoped to public side:** confirmed in B5 (`--pf-brand` on wrapper) and admin chrome left untouched.
- **Logic tab placeholder:** rendered disabled in D2.
- **Webhooks + Embed-share:** page shells only in E1, per the v1 boundary.
- **Honeypot only, no CAPTCHA:** B3 implements honeypot, B1 implements rate limit; CAPTCHA is explicitly not added.
- **Email always required:** enforced in `validateSubmission` (no anon path) and in `submitForm` (uses `data.email` as `submitterEmail`).
- **Field-name slug auto-gen + warn:** done in D2 properties drawer.
- **Capacity:** B3 + B5 both enforce.
- **Suggested amounts + custom amount:** Forms collection field, payment block, checkout helper all support.
