# Kiosk Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port kiosk/display-monitor functionality from `~/personal/kiosk` into open-masjid as native, tenant-scoped Payload collections plus a Next.js display route at `/kiosk/[deviceId]`. v1 = carousel + sponsor + weekly-events slides, typed-code device pairing, QR-code library, per-kiosk overrides, 60s polling + push-now button, `kioskManager` role.

**Architecture:** Five new tenant-scoped Payload collections (`Kiosks`, `CarouselSlides`, `SponsorSlides`, `WeeklyEventsSlides`, `QRCodes`). One Next.js display route polling a single `GET /api/kiosk/state` endpoint. Device-secret auth via `X-Kiosk-Device-Id` + `X-Kiosk-Secret` headers. Slide components, themes, and gradient constants ported from `~/personal/kiosk/apps/kiosk/src/components/carousel/` as Next.js client components. No WebSocket — polling + admin "push now" button bumps a version timestamp.

**Tech Stack:** Next.js 16, Payload CMS 3.84, Postgres, React 19, `adhan` (already installed), `bcrypt` (new), `qrcode` (new), vitest (already installed).

**Spec:** `docs/superpowers/specs/2026-05-14-kiosk-integration-design.md`

**Issue:** #75

---

## File Structure

**New files:**

```
src/
├── access/
│   ├── kioskRoles.ts                          # access helpers including kioskManager
│   └── kioskOnly.ts                           # access for non-kiosk collections (denies kioskManager)
├── collections/
│   ├── Kiosks.ts                              # device registry, status, overrides
│   ├── CarouselSlides.ts
│   ├── SponsorSlides.ts
│   ├── WeeklyEventsSlides.ts
│   └── QRCodes.ts
├── hooks/
│   ├── generateQrPng.ts                       # QRCodes afterChange → PNG into Media
│   └── pairKioskOnSave.ts                     # Kiosks beforeChange → match pairingCode → mint creds
├── lib/
│   └── kiosk/
│       ├── auth.ts                            # verifyDeviceHeaders, hash helpers
│       ├── pairingCode.ts                     # generate / parse 6-char codes
│       ├── composeState.ts                    # build state bundle from collections
│       └── versionHash.ts                     # stable hash for change detection
├── app/
│   ├── (kiosk)/                               # route group with no shell chrome
│   │   ├── layout.tsx                         # bare layout, fullscreen
│   │   ├── kiosk/
│   │   │   ├── page.tsx                       # pairing screen
│   │   │   └── [deviceId]/
│   │   │       └── page.tsx                   # display screen
│   │   └── _components/                       # ported display components
│   │       ├── CarouselLayout.tsx
│   │       ├── CarouselErrorBoundary.tsx
│   │       ├── CustomSlide.tsx
│   │       ├── AdvertiserSlide.tsx
│   │       ├── WeeklyEventsSlide.tsx
│   │       ├── PrayerTimesSlide.tsx
│   │       ├── IslamicContentSlide.tsx
│   │       ├── IslamicContentDisplay.tsx
│   │       ├── QRCodeDisplay.tsx
│   │       └── PrayerTimesStrip.tsx           # always-visible bottom bar
│   │   └── _lib/
│   │       ├── themes/islamicThemes.ts
│   │       ├── constants/gradients.ts
│   │       └── constants/islamicContent.ts    # Quran/dua text from kiosk repo
│   └── api/
│       └── kiosk/
│           ├── state/route.ts                 # GET — device-auth + bundle
│           ├── claim/route.ts                 # POST — pairing claim
│           ├── push/route.ts                  # POST — admin push-now
│           └── cron/route.ts                  # GET — Vercel Cron OFFLINE flip
└── globals/
    └── kioskAdminHide.ts                      # hide non-kiosk groups for kioskManager
tests/
└── kiosk/
    ├── pairingCode.test.ts
    ├── auth.test.ts
    ├── composeState.test.ts
    ├── versionHash.test.ts
    └── access.test.ts
```

**Modified files:**

- `src/collections/Users.ts` — add `kioskManager` role to the `role` select.
- `src/collections/Tenants.ts` — add `kioskBroadcastAt` timestamp field.
- `src/payload.config.ts` — register the five new collections.
- `package.json` — add `bcrypt`, `qrcode`, `@types/bcrypt`, `@types/qrcode`.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```
npm install bcrypt qrcode
```

- [ ] **Step 2: Install type deps**

```
npm install --save-dev @types/bcrypt @types/qrcode
```

- [ ] **Step 3: Verify versions**

Run: `npm list bcrypt qrcode`
Expected: both listed with no peer-dep warnings.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(kiosk): add bcrypt and qrcode deps (#75)"
```

---

## Task 2: Add `kioskManager` role

**Files:**
- Modify: `src/collections/Users.ts` (the `role` select around line 247)

- [ ] **Step 1: Add option to the role select**

In `src/collections/Users.ts`, in the `options` array of the `role` field, add this entry after `staff`:

```ts
{ label: 'Kiosk Manager (kiosk content only within one tenant)', value: 'kioskManager' },
```

- [ ] **Step 2: Update field description**

Replace the `admin.description` of the `role` field with:

```
'Platform Owner manages every masjid and the platform itself. Admin can change settings, branding, and users within one masjid. Staff can add/edit content (events, prayer times, announcements) but cannot change settings or manage users. Kiosk Manager can only manage kiosk displays and slide content.'
```

- [ ] **Step 3: Update validate hook to allow `kioskManager`**

Around line 298, locate the `validate` function on the `role` field and ensure the allowed-values check accepts `kioskManager` (if there's an explicit list — if it's just falling through to Payload's select validation, no change needed).

- [ ] **Step 4: Verify build**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Users.ts
git commit -m "feat(kiosk): add kioskManager role (#75)"
```

---

## Task 3: Add `kioskBroadcastAt` to Tenants

**Files:**
- Modify: `src/collections/Tenants.ts`

- [ ] **Step 1: Add the field**

Locate the `fields` array in `src/collections/Tenants.ts`. Add this field (near the end, before any closing brackets):

```ts
{
  name: 'kioskBroadcastAt',
  type: 'date',
  label: 'Kiosk Broadcast Timestamp',
  admin: {
    hidden: true,
    description: 'Internal — bumped when admin clicks "Push update to all kiosks".',
  },
},
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/collections/Tenants.ts
git commit -m "feat(kiosk): add kioskBroadcastAt to tenants (#75)"
```

---

## Task 4: Pairing code utility + tests

**Files:**
- Create: `src/lib/kiosk/pairingCode.ts`
- Create: `tests/kiosk/pairingCode.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/kiosk/pairingCode.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generatePairingCode, normalizePairingCode, isValidPairingCode } from '@/lib/kiosk/pairingCode'

describe('pairingCode', () => {
  it('generates a code matching XXX-XXX format with allowed chars', () => {
    for (let i = 0; i < 50; i++) {
      const code = generatePairingCode()
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/)
    }
  })

  it('normalizes lowercase, missing hyphen, surrounding whitespace', () => {
    expect(normalizePairingCode(' k7m3pq ')).toBe('K7M-3PQ')
    expect(normalizePairingCode('k7m-3pq')).toBe('K7M-3PQ')
    expect(normalizePairingCode('K7M3PQ')).toBe('K7M-3PQ')
  })

  it('rejects ambiguous chars (0, O, 1, I, L)', () => {
    expect(isValidPairingCode('O0O-1IL')).toBe(false)
  })

  it('accepts valid code', () => {
    expect(isValidPairingCode('K7M-3PQ')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pairingCode`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/kiosk/pairingCode.ts`:

```ts
import { randomInt } from 'node:crypto'

// Ambiguous chars removed: 0, O, 1, I, L (visual confusion on TV screens).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const SEGMENT = 3

export function generatePairingCode(): string {
  const pick = () => ALPHABET[randomInt(0, ALPHABET.length)]
  const segment = () => Array.from({ length: SEGMENT }, pick).join('')
  return `${segment()}-${segment()}`
}

export function normalizePairingCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (cleaned.length !== SEGMENT * 2) return cleaned
  return `${cleaned.slice(0, SEGMENT)}-${cleaned.slice(SEGMENT)}`
}

export function isValidPairingCode(raw: string): boolean {
  const normalized = normalizePairingCode(raw)
  return /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/.test(normalized)
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- pairingCode`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk/pairingCode.ts tests/kiosk/pairingCode.test.ts
git commit -m "feat(kiosk): pairing code utility (#75)"
```

---

## Task 5: Device auth helpers + tests

**Files:**
- Create: `src/lib/kiosk/auth.ts`
- Create: `tests/kiosk/auth.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/kiosk/auth.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hashSecret, verifySecret, generateDeviceSecret } from '@/lib/kiosk/auth'

describe('kiosk auth', () => {
  it('generateDeviceSecret returns a 64-char hex string', () => {
    const secret = generateDeviceSecret()
    expect(secret).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hashSecret produces a bcrypt hash that verifySecret can validate', async () => {
    const secret = generateDeviceSecret()
    const hash = await hashSecret(secret)
    expect(hash).toMatch(/^\$2[aby]\$/)
    expect(await verifySecret(secret, hash)).toBe(true)
  })

  it('verifySecret returns false for mismatched secret', async () => {
    const hash = await hashSecret(generateDeviceSecret())
    expect(await verifySecret(generateDeviceSecret(), hash)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- auth`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/kiosk/auth.ts`:

```ts
import bcrypt from 'bcrypt'
import { randomBytes } from 'node:crypto'

const SALT_ROUNDS = 10

export function generateDeviceSecret(): string {
  return randomBytes(32).toString('hex')
}

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS)
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash)
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- auth`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk/auth.ts tests/kiosk/auth.test.ts
git commit -m "feat(kiosk): device auth helpers (#75)"
```

---

## Task 6: `Kiosks` collection

**Files:**
- Create: `src/collections/Kiosks.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create the collection**

Create `src/collections/Kiosks.ts`:

```ts
import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { pairKioskOnSave } from '../hooks/pairKioskOnSave'

export const Kiosks: CollectionConfig = {
  slug: 'kiosks',
  labels: { singular: 'Kiosk', plural: 'Kiosks' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'location', 'status', 'lastSeenAt'],
    description: 'Physical display screens. Pair a new kiosk by typing the code shown on its screen into the Pairing Code field below.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser, pairKioskOnSave],
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Display Name' },
    { name: 'location', type: 'text', label: 'Location (e.g. Lobby, Hall)' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'UNPAIRED',
      options: [
        { label: 'Unpaired', value: 'UNPAIRED' },
        { label: 'Online', value: 'ONLINE' },
        { label: 'Offline', value: 'OFFLINE' },
        { label: 'Maintenance', value: 'MAINTENANCE' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'pairingCode',
      type: 'text',
      label: 'Pairing Code',
      admin: {
        description: 'Type the 6-character code shown on the kiosk screen here, then save. Format: ABC-123.',
        placeholder: 'ABC-123',
      },
    },
    { name: 'deviceId', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'secretHash', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'pairingCodeExpiresAt', type: 'date', admin: { readOnly: true, hidden: true } },
    { name: 'lastSeenAt', type: 'date', admin: { readOnly: true } },
    { name: 'lastSeenIp', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'userAgent', type: 'text', admin: { readOnly: true, hidden: true } },
    { name: 'kioskPushAt', type: 'date', admin: { readOnly: true, hidden: true } },
    {
      name: 'overrideEnabled',
      type: 'checkbox',
      defaultValue: false,
      label: 'Override Slide Playlist',
      admin: { description: 'When on, this kiosk shows only the slides selected below.' },
    },
    {
      name: 'slideOverrides',
      type: 'relationship',
      relationTo: ['carousel-slides', 'sponsor-slides', 'weekly-events-slides'],
      hasMany: true,
      admin: {
        condition: (data) => Boolean(data?.overrideEnabled),
        description: 'Specific slides this kiosk should show (when override is on).',
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      label: 'Tenant',
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => (user as { role?: string } | null)?.role === 'platformOwner',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'platformOwner',
      },
    },
  ],
}
```

- [ ] **Step 2: Create a stub `pairKioskOnSave` hook**

Create `src/hooks/pairKioskOnSave.ts` (real logic comes in Task 9):

```ts
import type { CollectionBeforeChangeHook } from 'payload'

export const pairKioskOnSave: CollectionBeforeChangeHook = async ({ data }) => {
  // Real pairing logic added in Task 9.
  return data
}
```

- [ ] **Step 3: Register in payload config**

In `src/payload.config.ts`, add the import (alphabetical with siblings):

```ts
import { Kiosks } from './collections/Kiosks'
```

Then add `Kiosks` to the `collections: [...]` array.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Other slide collections referenced in `slideOverrides` don't exist yet — Payload tolerates unknown collection slugs at config time but the relationship will error at runtime. We'll add them in Tasks 7–8.)

- [ ] **Step 5: Generate migration**

Run: `npx payload migrate:create kiosks_collection`
Expected: a new file under `src/migrations/` is generated. Review it briefly.

- [ ] **Step 6: Commit**

```bash
git add src/collections/Kiosks.ts src/hooks/pairKioskOnSave.ts src/payload.config.ts src/migrations/
git commit -m "feat(kiosk): Kiosks collection (#75)"
```

---

## Task 7: `CarouselSlides`, `SponsorSlides`, `WeeklyEventsSlides` collections

These three are structurally similar; we add them in one task with separate files.

**Files:**
- Create: `src/collections/CarouselSlides.ts`
- Create: `src/collections/SponsorSlides.ts`
- Create: `src/collections/WeeklyEventsSlides.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create `CarouselSlides`**

Create `src/collections/CarouselSlides.ts`:

```ts
import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

export const CarouselSlides: CollectionConfig = {
  slug: 'carousel-slides',
  labels: { singular: 'Carousel Slide', plural: 'Carousel Slides' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active', 'priority', 'startDate', 'endDate'],
    description: 'Slides shown in rotation on the kiosk carousel.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'details1', type: 'textarea' },
    { name: 'details2', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'qrCode', type: 'relationship', relationTo: 'qr-codes' },
    {
      name: 'backgroundTheme',
      type: 'select',
      defaultValue: 'clean',
      options: [
        { label: 'Clean (animated gradient)', value: 'clean' },
        { label: 'Geometric', value: 'geometric' },
        { label: 'Arabesque', value: 'arabesque' },
        { label: 'Mihrab', value: 'mihrab' },
      ],
    },
    { name: 'prayerTimingsEnabled', type: 'checkbox', defaultValue: false },
    {
      name: 'displayDurationMs',
      type: 'number',
      defaultValue: 10000,
      min: 5000,
      max: 60000,
      admin: { description: 'Time on screen in milliseconds (5000–60000).' },
    },
    { name: 'priority', type: 'number', defaultValue: 5, min: 0, max: 10 },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'startDate', type: 'date' },
    { name: 'endDate', type: 'date' },
    { name: 'showInCarousel', type: 'checkbox', defaultValue: true },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => (user as { role?: string } | null)?.role === 'platformOwner',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'platformOwner',
      },
    },
  ],
}
```

- [ ] **Step 2: Create `SponsorSlides`**

Create `src/collections/SponsorSlides.ts`:

```ts
import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export const SponsorSlides: CollectionConfig = {
  slug: 'sponsor-slides',
  labels: { singular: 'Sponsor Slide', plural: 'Sponsor Slides' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active', 'priority', 'layoutTemplate'],
    description: 'Advertiser / sponsor slides shown on the kiosk carousel.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200, label: 'Sponsor / Company Name' },
    { name: 'tagline', type: 'text', maxLength: 300 },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'brandColorPrimary',
      type: 'text',
      validate: (v: unknown) => !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
    },
    {
      name: 'brandColorSecondary',
      type: 'text',
      validate: (v: unknown) => !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
    },
    {
      name: 'backgroundStyle',
      type: 'select',
      defaultValue: 'gradient',
      options: [
        { label: 'Gradient', value: 'gradient' },
        { label: 'Solid', value: 'solid' },
        { label: 'Brand Primary', value: 'brand-primary' },
        { label: 'Brand Secondary', value: 'brand-secondary' },
      ],
    },
    {
      name: 'layoutTemplate',
      type: 'select',
      required: true,
      defaultValue: 'logo-left',
      options: [
        { label: 'Logo Left', value: 'logo-left' },
        { label: 'Logo Top Centered', value: 'logo-top-centered' },
        { label: 'Logo Dominant', value: 'logo-dominant' },
        { label: 'Split Screen', value: 'split-screen' },
      ],
    },
    { name: 'details1', type: 'text', maxLength: 300 },
    { name: 'details2', type: 'text', maxLength: 300 },
    { name: 'details3', type: 'text', maxLength: 300 },
    { name: 'contactPhone', type: 'text', maxLength: 50 },
    { name: 'contactAddress', type: 'text', maxLength: 300 },
    { name: 'contactWebsite', type: 'text', maxLength: 200 },
    { name: 'qrCode', type: 'relationship', relationTo: 'qr-codes' },
    { name: 'ctaText', type: 'text', maxLength: 100 },
    { name: 'displayDurationMs', type: 'number', defaultValue: 10000, min: 5000, max: 60000 },
    { name: 'priority', type: 'number', defaultValue: 5, min: 0, max: 10 },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'startDate', type: 'date' },
    { name: 'endDate', type: 'date' },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => (user as { role?: string } | null)?.role === 'platformOwner',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'platformOwner',
      },
    },
  ],
}
```

- [ ] **Step 3: Create `WeeklyEventsSlides`**

Create `src/collections/WeeklyEventsSlides.ts`:

```ts
import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'

export const WeeklyEventsSlides: CollectionConfig = {
  slug: 'weekly-events-slides',
  labels: { singular: 'Weekly Events Slide', plural: 'Weekly Events Slides' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'active'],
    description: 'Recurring weekly schedule shown on the kiosk.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: { beforeChange: [setTenantFromUser] },
  fields: [
    { name: 'title', type: 'text', required: true, defaultValue: 'Weekly Schedule' },
    {
      name: 'entries',
      type: 'array',
      label: 'Schedule Entries',
      fields: [
        {
          name: 'day',
          type: 'select',
          required: true,
          options: [
            { label: 'Monday', value: 'mon' },
            { label: 'Tuesday', value: 'tue' },
            { label: 'Wednesday', value: 'wed' },
            { label: 'Thursday', value: 'thu' },
            { label: 'Friday', value: 'fri' },
            { label: 'Saturday', value: 'sat' },
            { label: 'Sunday', value: 'sun' },
          ],
        },
        { name: 'time', type: 'text', required: true, admin: { placeholder: '7:00 PM' } },
        { name: 'name', type: 'text', required: true },
        { name: 'location', type: 'text' },
        { name: 'audience', type: 'text', admin: { description: 'Optional, e.g. "Sisters", "Youth"' } },
      ],
    },
    { name: 'displayDurationMs', type: 'number', defaultValue: 15000, min: 5000, max: 60000 },
    { name: 'active', type: 'checkbox', defaultValue: true },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => (user as { role?: string } | null)?.role === 'platformOwner',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'platformOwner',
      },
    },
  ],
}
```

- [ ] **Step 4: Register in payload config**

In `src/payload.config.ts`, add imports:

```ts
import { CarouselSlides } from './collections/CarouselSlides'
import { SponsorSlides } from './collections/SponsorSlides'
import { WeeklyEventsSlides } from './collections/WeeklyEventsSlides'
```

Add all three to the `collections: [...]` array (keep alphabetical with siblings).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Migration**

Run: `npx payload migrate:create slide_collections`
Expected: a new migration file is generated.

- [ ] **Step 7: Commit**

```bash
git add src/collections/CarouselSlides.ts src/collections/SponsorSlides.ts src/collections/WeeklyEventsSlides.ts src/payload.config.ts src/migrations/
git commit -m "feat(kiosk): carousel, sponsor, weekly-events slide collections (#75)"
```

---

## Task 8: `QRCodes` collection + PNG generation hook

**Files:**
- Create: `src/collections/QRCodes.ts`
- Create: `src/hooks/generateQrPng.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create the generation hook**

Create `src/hooks/generateQrPng.ts`:

```ts
import type { CollectionAfterChangeHook } from 'payload'
import QRCode from 'qrcode'

export const generateQrPng: CollectionAfterChangeHook = async ({ doc, req, operation, previousDoc }) => {
  const targetChanged = !previousDoc
    || previousDoc.targetUrl !== doc.targetUrl
    || previousDoc.fgColor !== doc.fgColor
    || previousDoc.bgColor !== doc.bgColor

  if (operation === 'update' && !targetChanged) return doc
  if (!doc.targetUrl) return doc

  const buffer = await QRCode.toBuffer(doc.targetUrl, {
    type: 'png',
    color: {
      dark: doc.fgColor || '#000000',
      light: doc.bgColor || '#FFFFFF',
    },
    width: 512,
    margin: 2,
  })

  const filename = `qr-${doc.id}.png`

  // Upload into Media. If a prior generatedImage exists, replace it; else create new.
  if (doc.generatedImage) {
    await req.payload.update({
      collection: 'media',
      id: doc.generatedImage,
      data: { alt: doc.label || filename },
      file: { data: buffer, mimetype: 'image/png', name: filename, size: buffer.length },
    })
    return doc
  }

  const media = await req.payload.create({
    collection: 'media',
    data: { alt: doc.label || filename, tenant: doc.tenant },
    file: { data: buffer, mimetype: 'image/png', name: filename, size: buffer.length },
  })

  await req.payload.update({
    collection: 'qr-codes',
    id: doc.id,
    data: { generatedImage: media.id },
  })

  return { ...doc, generatedImage: media.id }
}
```

- [ ] **Step 2: Create the collection**

Create `src/collections/QRCodes.ts`:

```ts
import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { generateQrPng } from '../hooks/generateQrPng'

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

export const QRCodes: CollectionConfig = {
  slug: 'qr-codes',
  labels: { singular: 'QR Code', plural: 'QR Codes' },
  admin: {
    enableListViewSelectAPI: true,
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'label',
    defaultColumns: ['label', 'targetUrl', 'createdAt'],
    description: 'Reusable QR codes attached to carousel and sponsor slides.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
    afterChange: [generateQrPng],
  },
  fields: [
    { name: 'label', type: 'text', required: true, label: 'Internal Label' },
    { name: 'targetUrl', type: 'text', required: true, label: 'Target URL' },
    {
      name: 'fgColor',
      type: 'text',
      defaultValue: '#000000',
      label: 'Foreground Color',
      validate: (v: unknown) => !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
    },
    {
      name: 'bgColor',
      type: 'text',
      defaultValue: '#FFFFFF',
      label: 'Background Color',
      validate: (v: unknown) => !v || (typeof v === 'string' && HEX_COLOR.test(v)) || 'Must be #RRGGBB',
    },
    { name: 'generatedImage', type: 'upload', relationTo: 'media', admin: { readOnly: true } },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) => (user as { role?: string } | null)?.role === 'platformOwner',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'platformOwner',
      },
    },
  ],
}
```

- [ ] **Step 3: Register**

In `src/payload.config.ts`, add the import and add `QRCodes` to `collections: [...]`.

- [ ] **Step 4: Typecheck + migrate**

```
npx tsc --noEmit
npx payload migrate:create qr_codes_collection
```

- [ ] **Step 5: Commit**

```bash
git add src/collections/QRCodes.ts src/hooks/generateQrPng.ts src/payload.config.ts src/migrations/
git commit -m "feat(kiosk): QRCodes collection with PNG generation (#75)"
```

---

## Task 9: Pairing flow — `pairKioskOnSave` hook + `/api/kiosk/claim`

**Files:**
- Modify: `src/hooks/pairKioskOnSave.ts`
- Create: `src/app/api/kiosk/claim/route.ts`

- [ ] **Step 1: Implement `pairKioskOnSave`**

Replace `src/hooks/pairKioskOnSave.ts` with:

```ts
import type { CollectionBeforeChangeHook } from 'payload'
import { isValidPairingCode, normalizePairingCode } from '../lib/kiosk/pairingCode'

/**
 * When admin types a pairing code into a Kiosks record, normalize it and
 * stamp a 15-minute expiry. Mint of deviceId+secret happens server-side
 * in `/api/kiosk/claim` when the kiosk polls in with the matching code.
 */
export const pairKioskOnSave: CollectionBeforeChangeHook = async ({ data, originalDoc, operation }) => {
  if (operation === 'create' || !data?.pairingCode) return data

  const raw = String(data.pairingCode).trim()
  if (!raw) {
    // Allow clearing
    return { ...data, pairingCode: null, pairingCodeExpiresAt: null }
  }

  const normalized = normalizePairingCode(raw)
  if (!isValidPairingCode(normalized)) {
    throw new Error('Invalid pairing code format. Expected ABC-123.')
  }

  // Don't reset expiry if the same code is being re-saved.
  if (originalDoc?.pairingCode === normalized && originalDoc?.pairingCodeExpiresAt) {
    return { ...data, pairingCode: normalized }
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  return { ...data, pairingCode: normalized, pairingCodeExpiresAt: expiresAt.toISOString() }
}
```

- [ ] **Step 2: Create the claim route**

Create `src/app/api/kiosk/claim/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { isValidPairingCode, normalizePairingCode } from '@/lib/kiosk/pairingCode'
import { generateDeviceSecret, hashSecret } from '@/lib/kiosk/auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const { code } = await req.json().catch(() => ({}))
  if (!code || !isValidPairingCode(code)) {
    return NextResponse.json({ status: 'invalid' }, { status: 400 })
  }

  const normalized = normalizePairingCode(code)
  const payload = await getPayload({ config })

  const { docs } = await payload.find({
    collection: 'kiosks',
    where: { pairingCode: { equals: normalized } },
    limit: 1,
    overrideAccess: true,
  })

  const kiosk = docs[0]
  if (!kiosk) return NextResponse.json({ status: 'pending' }, { status: 404 })

  const expiresAt = kiosk.pairingCodeExpiresAt ? new Date(kiosk.pairingCodeExpiresAt) : null
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ status: 'expired' }, { status: 410 })
  }

  // If already paired (e.g. on a retry), refuse — admin must reset first.
  if (kiosk.deviceId && kiosk.secretHash) {
    return NextResponse.json({ status: 'already-paired' }, { status: 409 })
  }

  const deviceId = crypto.randomUUID()
  const secret = generateDeviceSecret()
  const secretHash = await hashSecret(secret)

  await payload.update({
    collection: 'kiosks',
    id: kiosk.id,
    overrideAccess: true,
    data: {
      deviceId,
      secretHash,
      pairingCode: null,
      pairingCodeExpiresAt: null,
      status: 'ONLINE',
      lastSeenAt: new Date().toISOString(),
    },
  })

  return NextResponse.json({ status: 'paired', deviceId, secret })
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/pairKioskOnSave.ts src/app/api/kiosk/claim/route.ts
git commit -m "feat(kiosk): pairing flow — code save hook + claim endpoint (#75)"
```

---

## Task 10: Pairing screen UI (`/kiosk`)

**Files:**
- Create: `src/app/(kiosk)/layout.tsx`
- Create: `src/app/(kiosk)/kiosk/page.tsx`

- [ ] **Step 1: Bare layout**

Create `src/app/(kiosk)/layout.tsx`:

```tsx
import './kiosk.css'

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', overflow: 'hidden' }}>
        {children}
      </body>
    </html>
  )
}
```

Create `src/app/(kiosk)/kiosk.css` (empty for now; populated later):

```css
:root { color-scheme: dark; }
```

- [ ] **Step 2: Pairing page**

Create `src/app/(kiosk)/kiosk/page.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

type Claim = { status: 'paired'; deviceId: string; secret: string } | { status: string }

function makeLocalCode(): string {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const r = (n: number) => Array.from({ length: n }, () => A[Math.floor(Math.random() * A.length)]).join('')
  return `${r(3)}-${r(3)}`
}

export default function PairingPage() {
  const [code, setCode] = useState<string>('')
  const [status, setStatus] = useState<string>('waiting')

  useEffect(() => {
    // Re-use a saved code across reloads so the admin can finish entering it.
    const saved = localStorage.getItem('kiosk:pairingCode')
    const initial = saved || makeLocalCode()
    if (!saved) localStorage.setItem('kiosk:pairingCode', initial)
    setCode(initial)
  }, [])

  useEffect(() => {
    if (!code) return
    const tick = async () => {
      try {
        const res = await fetch('/api/kiosk/claim', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data: Claim = await res.json().catch(() => ({ status: 'error' }))
        if (data.status === 'paired' && 'deviceId' in data) {
          localStorage.setItem('kiosk:deviceId', data.deviceId)
          localStorage.setItem('kiosk:secret', data.secret)
          localStorage.removeItem('kiosk:pairingCode')
          window.location.replace(`/kiosk/${data.deviceId}`)
          return
        }
        setStatus(data.status)
      } catch {
        setStatus('network-error')
      }
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => clearInterval(id)
  }, [code])

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ opacity: 0.6, marginBottom: '1rem', fontSize: '1.5rem' }}>Enter this code in your admin panel</p>
      <h1 style={{ fontSize: '12rem', letterSpacing: '0.1em', margin: 0 }}>{code || '...'}</h1>
      <p style={{ marginTop: '2rem', opacity: 0.5 }}>{status === 'waiting' ? 'Waiting for pairing...' : `Status: ${status}`}</p>
    </main>
  )
}
```

- [ ] **Step 3: Run dev server, manually verify**

Run: `npm run dev` then open `http://localhost:3000/kiosk` in a browser. Expected: pairing code shown, polling visible in Network tab every 3s.

- [ ] **Step 4: Commit**

```bash
git add src/app/(kiosk)
git commit -m "feat(kiosk): pairing screen with code polling (#75)"
```

---

## Task 11: Version hash + state composition with tests

**Files:**
- Create: `src/lib/kiosk/versionHash.ts`
- Create: `src/lib/kiosk/composeState.ts`
- Create: `tests/kiosk/versionHash.test.ts`
- Create: `tests/kiosk/composeState.test.ts`

- [ ] **Step 1: Write versionHash test**

Create `tests/kiosk/versionHash.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { versionHash } from '@/lib/kiosk/versionHash'

describe('versionHash', () => {
  it('is stable for identical input', () => {
    const a = versionHash({ slideIds: ['a', 'b'], slideUpdatedAts: ['2026-01-01', '2026-01-02'], day: '2026-05-14', broadcastAt: null, pushAt: null })
    const b = versionHash({ slideIds: ['a', 'b'], slideUpdatedAts: ['2026-01-01', '2026-01-02'], day: '2026-05-14', broadcastAt: null, pushAt: null })
    expect(a).toEqual(b)
  })

  it('changes when a slide updatedAt changes', () => {
    const a = versionHash({ slideIds: ['a'], slideUpdatedAts: ['2026-01-01'], day: '2026-05-14', broadcastAt: null, pushAt: null })
    const b = versionHash({ slideIds: ['a'], slideUpdatedAts: ['2026-01-02'], day: '2026-05-14', broadcastAt: null, pushAt: null })
    expect(a).not.toEqual(b)
  })

  it('changes when pushAt bumps', () => {
    const base = { slideIds: ['a'], slideUpdatedAts: ['2026-01-01'], day: '2026-05-14', broadcastAt: null }
    const a = versionHash({ ...base, pushAt: null })
    const b = versionHash({ ...base, pushAt: '2026-05-14T12:00:00Z' })
    expect(a).not.toEqual(b)
  })
})
```

- [ ] **Step 2: Implement versionHash**

Create `src/lib/kiosk/versionHash.ts`:

```ts
import { createHash } from 'node:crypto'

export interface VersionInput {
  slideIds: string[]
  slideUpdatedAts: string[]
  day: string
  broadcastAt: string | null
  pushAt: string | null
}

export function versionHash(input: VersionInput): string {
  const parts = [
    input.slideIds.join(','),
    input.slideUpdatedAts.join(','),
    input.day,
    input.broadcastAt ?? '',
    input.pushAt ?? '',
  ].join('|')
  return createHash('sha1').update(parts).digest('hex').slice(0, 16)
}
```

- [ ] **Step 3: Write composeState test (skeleton)**

Create `tests/kiosk/composeState.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { filterAndSortSlides } from '@/lib/kiosk/composeState'

const base = (overrides: Partial<{ id: string; active: boolean; priority: number; startDate: string | null; endDate: string | null; updatedAt: string }>) => ({
  id: overrides.id ?? '1',
  type: 'carousel' as const,
  active: overrides.active ?? true,
  priority: overrides.priority ?? 5,
  startDate: overrides.startDate ?? null,
  endDate: overrides.endDate ?? null,
  updatedAt: overrides.updatedAt ?? '2026-05-14T00:00:00Z',
  durationMs: 10000,
  payload: {},
})

describe('filterAndSortSlides', () => {
  const NOW = new Date('2026-05-14T12:00:00Z')

  it('excludes inactive slides', () => {
    const slides = [base({ id: '1', active: false }), base({ id: '2', active: true })]
    expect(filterAndSortSlides(slides, NOW, null).map(s => s.id)).toEqual(['2'])
  })

  it('excludes slides outside date range', () => {
    const slides = [
      base({ id: '1', endDate: '2026-05-13T00:00:00Z' }),
      base({ id: '2', startDate: '2026-06-01T00:00:00Z' }),
      base({ id: '3' }),
    ]
    expect(filterAndSortSlides(slides, NOW, null).map(s => s.id)).toEqual(['3'])
  })

  it('sorts by priority descending then updatedAt ascending', () => {
    const slides = [
      base({ id: 'a', priority: 3, updatedAt: '2026-05-14T01:00:00Z' }),
      base({ id: 'b', priority: 5, updatedAt: '2026-05-14T02:00:00Z' }),
      base({ id: 'c', priority: 5, updatedAt: '2026-05-14T01:00:00Z' }),
    ]
    expect(filterAndSortSlides(slides, NOW, null).map(s => s.id)).toEqual(['c', 'b', 'a'])
  })

  it('intersects with overrides when provided', () => {
    const slides = [base({ id: '1' }), base({ id: '2' }), base({ id: '3' })]
    expect(filterAndSortSlides(slides, NOW, ['2', '3']).map(s => s.id).sort()).toEqual(['2', '3'])
  })
})
```

- [ ] **Step 4: Implement composeState (pure filter/sort + payload fetch shape)**

Create `src/lib/kiosk/composeState.ts`:

```ts
import type { Payload } from 'payload'

export type SlideType = 'carousel' | 'sponsor' | 'weekly-events'

export interface NormalizedSlide {
  id: string
  type: SlideType
  active: boolean
  priority: number
  startDate: string | null
  endDate: string | null
  updatedAt: string
  durationMs: number
  payload: Record<string, unknown>
}

export function filterAndSortSlides(
  slides: NormalizedSlide[],
  now: Date,
  overrideIds: string[] | null,
): NormalizedSlide[] {
  const ms = now.getTime()
  const overrideSet = overrideIds ? new Set(overrideIds) : null
  return slides
    .filter(s => s.active)
    .filter(s => !s.startDate || new Date(s.startDate).getTime() <= ms)
    .filter(s => !s.endDate || new Date(s.endDate).getTime() >= ms)
    .filter(s => !overrideSet || overrideSet.has(s.id))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    })
}

export interface KioskState {
  tenant: { id: string; name: string; logo: string | null; timezone: string }
  prayerTimes: Record<string, unknown> | null
  slides: NormalizedSlide[]
  version: string
  pollIntervalMs: number
}

export async function composeKioskState(args: {
  payload: Payload
  tenantId: string
  now: Date
  overrideIds: string[] | null
  broadcastAt: string | null
  pushAt: string | null
}): Promise<{ slides: NormalizedSlide[]; tenant: KioskState['tenant'] }> {
  const { payload, tenantId, now, overrideIds } = args

  const [carousel, sponsors, weekly, tenantDoc] = await Promise.all([
    payload.find({ collection: 'carousel-slides', where: { tenant: { equals: tenantId } }, limit: 200, overrideAccess: true }),
    payload.find({ collection: 'sponsor-slides', where: { tenant: { equals: tenantId } }, limit: 200, overrideAccess: true }),
    payload.find({ collection: 'weekly-events-slides', where: { tenant: { equals: tenantId } }, limit: 50, overrideAccess: true }),
    payload.findByID({ collection: 'tenants', id: tenantId, overrideAccess: true }),
  ])

  const normalize = (type: SlideType) => (doc: any): NormalizedSlide => ({
    id: String(doc.id),
    type,
    active: Boolean(doc.active),
    priority: Number(doc.priority ?? 5),
    startDate: doc.startDate ?? null,
    endDate: doc.endDate ?? null,
    updatedAt: doc.updatedAt ?? new Date(0).toISOString(),
    durationMs: Number(doc.displayDurationMs ?? 10000),
    payload: doc,
  })

  const all: NormalizedSlide[] = [
    ...carousel.docs.map(normalize('carousel')),
    ...sponsors.docs.map(normalize('sponsor')),
    ...weekly.docs.map(normalize('weekly-events')),
  ]

  const slides = filterAndSortSlides(all, now, overrideIds)

  const tenant: KioskState['tenant'] = {
    id: String((tenantDoc as any).id),
    name: (tenantDoc as any).name ?? '',
    logo: (tenantDoc as any).logo ?? null,
    timezone: (tenantDoc as any).timezone ?? 'UTC',
  }

  return { slides, tenant }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- versionHash composeState`
Expected: PASS, 7 tests total.

- [ ] **Step 6: Commit**

```bash
git add src/lib/kiosk/versionHash.ts src/lib/kiosk/composeState.ts tests/kiosk/
git commit -m "feat(kiosk): state composition + version hashing (#75)"
```

---

## Task 12: `GET /api/kiosk/state` endpoint

**Files:**
- Create: `src/app/api/kiosk/state/route.ts`

- [ ] **Step 1: Implement route**

Create `src/app/api/kiosk/state/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { verifySecret } from '@/lib/kiosk/auth'
import { composeKioskState } from '@/lib/kiosk/composeState'
import { versionHash } from '@/lib/kiosk/versionHash'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const deviceId = req.headers.get('x-kiosk-device-id')
  const secret = req.headers.get('x-kiosk-secret')
  if (!deviceId || !secret) {
    return NextResponse.json({ error: 'missing-credentials' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'kiosks',
    where: { deviceId: { equals: deviceId } },
    limit: 1,
    overrideAccess: true,
  })

  const kiosk = docs[0]
  if (!kiosk || !kiosk.secretHash) {
    return NextResponse.json({ error: 'unknown-device' }, { status: 401 })
  }

  const ok = await verifySecret(secret, kiosk.secretHash)
  if (!ok) return NextResponse.json({ error: 'bad-secret' }, { status: 401 })

  const tenantId = typeof kiosk.tenant === 'object' ? (kiosk.tenant as { id: string }).id : kiosk.tenant
  const tenantDoc = await payload.findByID({ collection: 'tenants', id: tenantId, overrideAccess: true })

  const now = new Date()
  const overrideIds = kiosk.overrideEnabled && Array.isArray(kiosk.slideOverrides)
    ? kiosk.slideOverrides.map((rel: any) => String(rel.value ?? rel.id ?? rel))
    : null

  const { slides, tenant } = await composeKioskState({
    payload,
    tenantId: String(tenantId),
    now,
    overrideIds,
    broadcastAt: (tenantDoc as any).kioskBroadcastAt ?? null,
    pushAt: kiosk.kioskPushAt ?? null,
  })

  // Fetch today's prayer schedule. The existing PrayerSchedules collection
  // owns the lookup logic; for now we read the most-recent active schedule.
  const schedules = await payload.find({
    collection: 'prayer-schedules',
    where: { tenant: { equals: tenantId } },
    sort: '-startDate',
    limit: 1,
    overrideAccess: true,
  })
  const prayerTimes = schedules.docs[0] ?? null

  const dayKey = now.toISOString().slice(0, 10)
  const version = versionHash({
    slideIds: slides.map(s => `${s.type}:${s.id}`),
    slideUpdatedAts: slides.map(s => s.updatedAt),
    day: dayKey,
    broadcastAt: (tenantDoc as any).kioskBroadcastAt ?? null,
    pushAt: kiosk.kioskPushAt ?? null,
  })

  // Heartbeat: update lastSeenAt + IP + UA.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  await payload.update({
    collection: 'kiosks',
    id: kiosk.id,
    overrideAccess: true,
    data: {
      lastSeenAt: now.toISOString(),
      lastSeenIp: ip,
      userAgent: req.headers.get('user-agent') ?? null,
      status: 'ONLINE',
    },
  })

  return NextResponse.json({
    tenant,
    prayerTimes,
    slides,
    version,
    pollIntervalMs: 60_000,
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke**

After completing Task 9, with a paired kiosk in localStorage:

```
curl -H "X-Kiosk-Device-Id: <id>" -H "X-Kiosk-Secret: <secret>" http://localhost:3000/api/kiosk/state | jq .version
```

Expected: a 16-char hex string.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kiosk/state/route.ts
git commit -m "feat(kiosk): GET /api/kiosk/state with device auth + heartbeat (#75)"
```

---

## Task 13: Port slide components from kiosk repo

This task copies React components verbatim where possible, with three mechanical changes:

1. Replace `import.meta.env.VITE_*` with the equivalent Next.js fetch path.
2. Replace `useCarouselSlides` / Zustand store reads with props passed down from the page.
3. Remove `socket.io-client` imports (we don't push via WS).

**Files:**
- Create: `src/app/(kiosk)/_components/CarouselLayout.tsx`
- Create: `src/app/(kiosk)/_components/CarouselErrorBoundary.tsx`
- Create: `src/app/(kiosk)/_components/CustomSlide.tsx`
- Create: `src/app/(kiosk)/_components/AdvertiserSlide.tsx`
- Create: `src/app/(kiosk)/_components/WeeklyEventsSlide.tsx`
- Create: `src/app/(kiosk)/_components/PrayerTimesSlide.tsx`
- Create: `src/app/(kiosk)/_components/PrayerTimesStrip.tsx`
- Create: `src/app/(kiosk)/_components/IslamicContentSlide.tsx`
- Create: `src/app/(kiosk)/_components/IslamicContentDisplay.tsx`
- Create: `src/app/(kiosk)/_components/QRCodeDisplay.tsx`
- Create: `src/app/(kiosk)/_lib/themes/islamicThemes.ts`
- Create: `src/app/(kiosk)/_lib/constants/gradients.ts`
- Create: `src/app/(kiosk)/_lib/constants/islamicContent.ts`

- [ ] **Step 1: Copy themes and constants verbatim**

```bash
cp ~/personal/kiosk/apps/kiosk/src/themes/islamicThemes.ts \
   src/app/\(kiosk\)/_lib/themes/islamicThemes.ts
cp ~/personal/kiosk/apps/kiosk/src/constants/gradientConstants.ts \
   src/app/\(kiosk\)/_lib/constants/gradients.ts
```

If the kiosk repo has additional constants used by `IslamicContentDisplay.tsx` (Quran verses / duas), find them and copy:

```bash
grep -r "from '\\.\\./constants" ~/personal/kiosk/apps/kiosk/src/components/carousel/IslamicContent*.tsx
```

Copy whatever paths it imports into `src/app/(kiosk)/_lib/constants/islamicContent.ts`.

- [ ] **Step 2: Copy components**

For each of `CarouselLayout`, `CarouselErrorBoundary`, `CustomSlide`, `AdvertiserSlide`, `WeeklyEventsSlide`, `PrayerTimesSlide`, `IslamicContentSlide`, `IslamicContentDisplay`, `QRCodeDisplay`:

```bash
cp ~/personal/kiosk/apps/kiosk/src/components/carousel/<Name>.tsx \
   src/app/\(kiosk\)/_components/<Name>.tsx
```

- [ ] **Step 3: Mechanical rewrites in each component**

For every copied file, prepend `'use client'` at the top (Next.js).

Rewrite imports:

| Old (kiosk repo) | New (open-masjid) |
|---|---|
| `import { CustomSlideData } from '../../hooks/useCarouselSlides';` | Define a local type matching the new shape: `type CustomSlideData = { id: string; title: string; details1?: string; details2?: string; backgroundTheme?: string; prayerTimingsEnabled?: boolean; qrCode?: { generatedImage?: string; targetUrl?: string; label?: string } | null; image?: { url: string } | null }` |
| `import { usePrayerTimes } from '../../hooks/usePrayerTimes';` | Accept `prayerTimes` as a prop instead — remove the import and rewire the component to read from props. |
| `import { getRandomGradient } from '../../constants/gradientConstants';` | `import { getRandomGradient } from '../_lib/constants/gradients';` |
| `import { getTheme } from '../../themes/islamicThemes';` | `import { getTheme } from '../_lib/themes/islamicThemes';` |
| `import.meta.env.VITE_API_URL` | Drop entirely. QR images come pre-resolved as Media URLs in the slide payload — see PrayerTimesStrip step below. |

If a component reads from Zustand stores (`useCarouselStore`, `useBlackoutStore`, etc.), replace with props passed in from `CarouselLayout` or the page.

- [ ] **Step 4: Create `PrayerTimesStrip`**

This is new (no kiosk-repo equivalent; the existing repo embeds it inside slide components). Create `src/app/(kiosk)/_components/PrayerTimesStrip.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

interface Props {
  prayerTimes: any
  tenantName: string
}

export function PrayerTimesStrip({ prayerTimes, tenantName }: Props) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!prayerTimes) {
    return <footer style={stripStyle}>{tenantName}</footer>
  }

  // PrayerSchedules.days[] shape from the existing collection.
  const today = (prayerTimes.days ?? []).find((d: any) => sameDay(new Date(d.date), now))
  if (!today) return <footer style={stripStyle}>{tenantName}</footer>

  const items: Array<[string, string, string | undefined]> = [
    ['Fajr', today.fajr, today.iqamah?.fajr],
    ['Dhuhr', today.dhuhr, today.iqamah?.dhuhr],
    ['Asr', today.asr, today.iqamah?.asr],
    ['Maghrib', today.maghrib, today.iqamah?.maghrib],
    ['Isha', today.isha, today.iqamah?.isha],
  ]

  return (
    <footer style={stripStyle}>
      {items.map(([name, adhan, iqamah]) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ opacity: 0.6, fontSize: '1rem' }}>{name}</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 600 }}>{fmt(adhan)}</span>
          {iqamah && <span style={{ opacity: 0.7, fontSize: '0.95rem' }}>Iqamah {fmt(iqamah)}</span>}
        </div>
      ))}
    </footer>
  )
}

const stripStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'space-around',
  padding: '1rem 2rem',
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(8px)',
  color: '#fff',
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const fmt = (raw: string | undefined) => {
  if (!raw) return '—'
  // Accept "HH:MM" or ISO; render as h:mm
  const m = /(\d{1,2}):(\d{2})/.exec(raw)
  if (!m) return raw
  let h = Number(m[1])
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${m[2]} ${ampm}`
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: any errors point at unfixed imports or types in the copied components. Resolve each one — these are mostly straightforward type mismatches between the kiosk repo's data shapes and the new Payload shapes. The slide payload fields you'll receive are exactly what's in the new collections (`CarouselSlides`, `SponsorSlides`, `WeeklyEventsSlides`).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(kiosk\)/_components src/app/\(kiosk\)/_lib
git commit -m "feat(kiosk): port slide components, themes, and gradients (#75)"
```

---

## Task 14: Display page `/kiosk/[deviceId]`

**Files:**
- Create: `src/app/(kiosk)/kiosk/[deviceId]/page.tsx`

- [ ] **Step 1: Implement**

Create `src/app/(kiosk)/kiosk/[deviceId]/page.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CarouselLayout } from '../../_components/CarouselLayout'
import { CustomSlide } from '../../_components/CustomSlide'
import { AdvertiserSlide } from '../../_components/AdvertiserSlide'
import { WeeklyEventsSlide } from '../../_components/WeeklyEventsSlide'
import { PrayerTimesSlide } from '../../_components/PrayerTimesSlide'
import { PrayerTimesStrip } from '../../_components/PrayerTimesStrip'
import { CarouselErrorBoundary } from '../../_components/CarouselErrorBoundary'

type Slide = { id: string; type: 'carousel' | 'sponsor' | 'weekly-events'; durationMs: number; payload: any }
type State = {
  tenant: { id: string; name: string; logo: string | null; timezone: string }
  prayerTimes: any
  slides: Slide[]
  version: string
  pollIntervalMs: number
}

export default function KioskDisplayPage({ params }: { params: { deviceId: string } }) {
  const [state, setState] = useState<State | null>(null)
  const [pendingState, setPendingState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const backoffRef = useRef(5000)

  const credentials = useMemo(() => ({
    deviceId: params.deviceId,
    secret: typeof window !== 'undefined' ? localStorage.getItem('kiosk:secret') : null,
  }), [params.deviceId])

  useEffect(() => {
    if (!credentials.secret) {
      window.location.replace('/kiosk')
      return
    }
    let active = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      try {
        const res = await fetch('/api/kiosk/state', {
          headers: {
            'x-kiosk-device-id': credentials.deviceId,
            'x-kiosk-secret': credentials.secret!,
          },
        })
        if (res.status === 401) {
          localStorage.removeItem('kiosk:secret')
          localStorage.removeItem('kiosk:deviceId')
          window.location.replace('/kiosk')
          return
        }
        const json: State = await res.json()
        if (!active) return
        backoffRef.current = 5000
        setError(null)
        setState(prev => {
          if (!prev) return json
          if (prev.version === json.version) return prev
          setPendingState(json)
          return prev
        })
        timer = setTimeout(tick, json.pollIntervalMs || 60_000)
      } catch (e) {
        if (!active) return
        setError(String(e))
        backoffRef.current = Math.min(backoffRef.current * 2, 300_000)
        timer = setTimeout(tick, backoffRef.current)
      }
    }
    tick()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [credentials])

  if (!state) {
    return <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading…</main>
  }

  const renderSlide = (slide: Slide) => {
    switch (slide.type) {
      case 'carousel': return <CustomSlide slide={slide.payload} prayerTimes={state.prayerTimes} />
      case 'sponsor': return <AdvertiserSlide slide={slide.payload} />
      case 'weekly-events': return <WeeklyEventsSlide slide={slide.payload} />
    }
  }

  const swapAtBoundary = () => {
    if (pendingState) {
      setState(pendingState)
      setPendingState(null)
    }
  }

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <CarouselErrorBoundary>
        <CarouselLayout slides={state.slides} renderSlide={renderSlide} onSlideAdvance={swapAtBoundary}>
          <PrayerTimesSlide prayerTimes={state.prayerTimes} tenantName={state.tenant.name} />
        </CarouselLayout>
      </CarouselErrorBoundary>
      <PrayerTimesStrip prayerTimes={state.prayerTimes} tenantName={state.tenant.name} />
      {error && <div style={{ position: 'absolute', top: 8, right: 8, opacity: 0.6 }}>● offline</div>}
    </main>
  )
}
```

> Note: `CarouselLayout` from the kiosk repo expects different props than what we pass here. As part of porting in Task 13, adapt `CarouselLayout.tsx` to accept `{ slides, renderSlide, onSlideAdvance }` props. Keep its internal timing logic (advancing by `slide.durationMs`).

- [ ] **Step 2: Manual end-to-end test**

1. `npm run dev`
2. Visit `/kiosk` in a browser → see a code (e.g. `K7M-3PQ`).
3. In Payload admin, open the test-tenant Kiosks collection, create a Kiosk, type the code into Pairing Code, save.
4. The pairing page should redirect to `/kiosk/<deviceId>`.
5. Verify slides render and the prayer-times strip is visible.
6. Add a Carousel Slide in admin → wait up to 60s → see it appear.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(kiosk\)/kiosk/\[deviceId\]/page.tsx
git commit -m "feat(kiosk): display page with polling and version-swap (#75)"
```

---

## Task 15: `POST /api/kiosk/push` (push-now)

**Files:**
- Create: `src/app/api/kiosk/push/route.ts`

- [ ] **Step 1: Implement**

Create `src/app/api/kiosk/push/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as { id: string; role?: string; tenant?: any } | null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const deviceId = url.searchParams.get('deviceId')
  const tenantQ = url.searchParams.get('tenant')

  const now = new Date().toISOString()

  if (deviceId) {
    const { docs } = await payload.find({
      collection: 'kiosks',
      where: { deviceId: { equals: deviceId } },
      limit: 1,
    })
    if (!docs[0]) return NextResponse.json({ error: 'not-found' }, { status: 404 })
    await payload.update({
      collection: 'kiosks',
      id: docs[0].id,
      data: { kioskPushAt: now },
    })
    return NextResponse.json({ ok: true })
  }

  // Tenant-wide broadcast
  const tenantId = tenantQ || (typeof user.tenant === 'object' ? user.tenant?.id : user.tenant)
  if (!tenantId) return NextResponse.json({ error: 'tenant-required' }, { status: 400 })

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: { kioskBroadcastAt: now },
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Manual test**

```
curl -X POST -b 'payload-token=<your admin session cookie>' \
  'http://localhost:3000/api/kiosk/push?tenant=<tenant-id>'
```

Expected: `{ "ok": true }`. Then a kiosk's next state poll returns a new `version`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/kiosk/push/route.ts
git commit -m "feat(kiosk): POST /api/kiosk/push for admin push-now (#75)"
```

---

## Task 16: Admin "Push update" custom view actions

**Files:**
- Create: `src/components/admin/KioskPushButton.tsx`
- Modify: `src/collections/Kiosks.ts` (wire into admin components)

- [ ] **Step 1: Create the button**

Create `src/components/admin/KioskPushButton.tsx`:

```tsx
'use client'
import { useState } from 'react'

export default function KioskPushButton({ deviceId, tenantId }: { deviceId?: string; tenantId?: string }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const click = async () => {
    setBusy(true)
    setMsg(null)
    const q = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : `?tenant=${encodeURIComponent(tenantId ?? '')}`
    const res = await fetch(`/api/kiosk/push${q}`, { method: 'POST' })
    setBusy(false)
    setMsg(res.ok ? 'Pushed — kiosks will update within 60s' : `Error: ${res.status}`)
  }

  return (
    <div style={{ padding: '0.5rem 0' }}>
      <button onClick={click} disabled={busy} style={{ padding: '0.5rem 1rem' }}>
        {busy ? 'Pushing…' : deviceId ? 'Push update to this kiosk' : 'Push update to all kiosks'}
      </button>
      {msg && <span style={{ marginLeft: '0.75rem', opacity: 0.7 }}>{msg}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Wire into the Kiosks edit view**

In `src/collections/Kiosks.ts`, add to the `admin` block:

```ts
admin: {
  // ...existing...
  components: {
    edit: {
      beforeDocumentControls: ['/src/components/admin/KioskPushButton#default'],
    },
  },
}
```

(Refer to Payload 3.84 custom-component docs if the exact location key differs. The goal: a button at the top of the Kiosk edit view.)

- [ ] **Step 3: Manual test**

Open a kiosk in admin → see "Push update to this kiosk" button → click → verify a kiosk on display picks up new content in <60s.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/KioskPushButton.tsx src/collections/Kiosks.ts
git commit -m "feat(kiosk): admin push-update buttons (#75)"
```

---

## Task 17: Cron — flip stale kiosks to OFFLINE

**Files:**
- Create: `src/app/api/kiosk/cron/route.ts`
- Modify: `vercel.json` (or create)

- [ ] **Step 1: Implement**

Create `src/app/api/kiosk/cron/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const cronSecret = process.env.KIOSK_CRON_SECRET
  if (cronSecret) {
    const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
    if (provided !== cronSecret) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const threshold = new Date(Date.now() - 3 * 60 * 1000).toISOString()

  const { docs } = await payload.find({
    collection: 'kiosks',
    where: {
      and: [
        { status: { equals: 'ONLINE' } },
        { lastSeenAt: { less_than: threshold } },
      ],
    },
    limit: 200,
    overrideAccess: true,
  })

  for (const k of docs) {
    await payload.update({
      collection: 'kiosks',
      id: k.id,
      data: { status: 'OFFLINE' },
      overrideAccess: true,
    })
  }

  return NextResponse.json({ flipped: docs.length })
}
```

- [ ] **Step 2: Schedule via Vercel Cron**

Add to `vercel.json` (create if missing):

```json
{
  "crons": [
    { "path": "/api/kiosk/cron", "schedule": "*/2 * * * *" }
  ]
}
```

- [ ] **Step 3: Document the cron secret**

Add `KIOSK_CRON_SECRET` to `.env.example` with a placeholder. (Vercel Cron sends an `Authorization: Bearer <CRON_SECRET>` automatically when you set one in project settings.)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kiosk/cron/route.ts vercel.json .env.example
git commit -m "feat(kiosk): cron to flip stale kiosks OFFLINE (#75)"
```

---

## Task 18: Access controls for `kioskManager`

The role exists (Task 2). Now restrict it: it can only read/write kiosk collections + read PrayerSchedules + Media; it cannot touch other collections.

**Files:**
- Create: `src/access/kioskRoles.ts`
- Modify: `src/collections/Pages.ts`, `src/collections/Events.ts`, `src/collections/Announcements.ts`, `src/collections/Forms.ts`, `src/collections/FormSubmissions.ts`, `src/collections/Members.ts`, `src/collections/MembershipTiers.ts`, `src/collections/Donations.ts`, `src/collections/DonationFunds.ts`, `src/collections/Services.ts`, `src/collections/HeroSlides.ts` — wrap their access fns to deny `kioskManager`.
- Create: `tests/kiosk/access.test.ts`

- [ ] **Step 1: Helper**

Create `src/access/kioskRoles.ts`:

```ts
import type { Access } from 'payload'

/**
 * Wraps an Access function so `kioskManager` users are always denied.
 * Use on collections that should be invisible to kiosk-only admins.
 */
export const denyKioskManager = (inner: Access): Access => (args) => {
  const user = args.req.user as { role?: string } | null | undefined
  if (user?.role === 'kioskManager') return false
  return inner(args)
}

/**
 * Allow kioskManager read-only access; defer to inner for everything else.
 */
export const allowKioskManagerRead = (inner: Access): Access => (args) => {
  const user = args.req.user as { role?: string } | null | undefined
  if (user?.role === 'kioskManager') {
    // Tenant-scoped read: only their tenant.
    const tenantId = typeof user === 'object' && user && 'tenant' in user
      ? (user as any).tenant?.id ?? (user as any).tenant
      : null
    if (!tenantId) return false
    return { tenant: { equals: tenantId } }
  }
  return inner(args)
}
```

- [ ] **Step 2: Apply `denyKioskManager` to non-kiosk collections**

For each of `Pages`, `Events`, `Announcements`, `Forms`, `FormSubmissions`, `Members`, `MembershipTiers`, `Donations`, `DonationFunds`, `Services`, `HeroSlides`:

Find the `access:` block and wrap each function:

```ts
access: {
  read: denyKioskManager(tenantScopedRead),
  create: denyKioskManager(withBillingLock(tenantScopedCreate)),
  update: denyKioskManager(withBillingLock(tenantScopedUpdate)),
  delete: denyKioskManager(withBillingLock(tenantScopedDelete)),
},
```

Import: `import { denyKioskManager } from '../access/kioskRoles'`.

- [ ] **Step 3: Allow read on PrayerSchedules + Media**

In `src/collections/PrayerSchedules.ts` and `src/collections/Media.ts`, wrap read with `allowKioskManagerRead` instead of denying. Other operations stay denied (kiosk manager should not edit prayer times or upload media).

- [ ] **Step 4: Write the test**

Create `tests/kiosk/access.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { denyKioskManager, allowKioskManagerRead } from '@/access/kioskRoles'

const mkReq = (role: string, tenantId = 't1') => ({
  req: { user: { role, tenant: { id: tenantId } } } as any,
}) as any

describe('kiosk role access', () => {
  it('denyKioskManager blocks kioskManager', () => {
    const inner = () => true
    expect(denyKioskManager(inner)(mkReq('kioskManager'))).toBe(false)
  })

  it('denyKioskManager defers for other roles', () => {
    const inner = () => true
    expect(denyKioskManager(inner)(mkReq('admin'))).toBe(true)
  })

  it('allowKioskManagerRead returns tenant filter for kioskManager', () => {
    const inner = () => false
    const result = allowKioskManagerRead(inner)(mkReq('kioskManager', 'tenantX'))
    expect(result).toEqual({ tenant: { equals: 'tenantX' } })
  })

  it('allowKioskManagerRead defers for other roles', () => {
    const inner = () => 'INNER'
    expect(allowKioskManagerRead(inner)(mkReq('admin') as any)).toBe('INNER')
  })
})
```

- [ ] **Step 5: Run tests**

Run: `npm test -- access`
Expected: PASS, 4 tests.

- [ ] **Step 6: Manual smoke**

In Payload admin, create a user with `role: kioskManager` for the test tenant. Log in as that user — verify they see only the Kiosk group in the sidebar and Media (read-only).

- [ ] **Step 7: Commit**

```bash
git add src/access/kioskRoles.ts src/collections/ tests/kiosk/access.test.ts
git commit -m "feat(kiosk): kioskManager role access controls (#75)"
```

---

## Task 19: "Reset pairing" admin action

**Files:**
- Create: `src/app/api/kiosk/reset/route.ts`
- Create: `src/components/admin/KioskResetButton.tsx`
- Modify: `src/collections/Kiosks.ts`

- [ ] **Step 1: Endpoint**

Create `src/app/api/kiosk/reset/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: await headers() })
  if (!auth.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { kioskId } = await req.json().catch(() => ({}))
  if (!kioskId) return NextResponse.json({ error: 'kioskId-required' }, { status: 400 })

  await payload.update({
    collection: 'kiosks',
    id: kioskId,
    data: {
      deviceId: null,
      secretHash: null,
      pairingCode: null,
      pairingCodeExpiresAt: null,
      status: 'UNPAIRED',
      lastSeenAt: null,
    },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Button**

Create `src/components/admin/KioskResetButton.tsx`:

```tsx
'use client'
import { useState } from 'react'

export default function KioskResetButton({ kioskId }: { kioskId: string }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const click = async () => {
    if (!confirm('Reset pairing? The kiosk will need to be re-paired.')) return
    setBusy(true)
    const res = await fetch('/api/kiosk/reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kioskId }),
    })
    setBusy(false)
    setMsg(res.ok ? 'Reset — refresh to see new state' : `Error: ${res.status}`)
  }
  return (
    <div style={{ padding: '0.5rem 0' }}>
      <button onClick={click} disabled={busy} style={{ padding: '0.5rem 1rem' }}>
        {busy ? 'Resetting…' : 'Reset pairing'}
      </button>
      {msg && <span style={{ marginLeft: '0.75rem', opacity: 0.7 }}>{msg}</span>}
    </div>
  )
}
```

- [ ] **Step 3: Wire into Kiosks admin**

In `src/collections/Kiosks.ts` add to `admin.components.edit.beforeDocumentControls` array:

```ts
'/src/components/admin/KioskResetButton#default',
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kiosk/reset src/components/admin/KioskResetButton.tsx src/collections/Kiosks.ts
git commit -m "feat(kiosk): reset pairing admin action (#75)"
```

---

## Task 20: Seed data + dev-tenant smoke

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 1: Add a seed block for kiosk content**

In `scripts/seed.ts`, after the tenant is created, add:

```ts
// --- Kiosk seed ---
const sampleQr = await payload.create({
  collection: 'qr-codes',
  data: { label: 'Donate', targetUrl: 'https://example.com/donate', tenant: tenant.id },
})

await payload.create({
  collection: 'carousel-slides',
  data: {
    title: 'Welcome to the Masjid',
    details1: 'Daily prayers and weekly classes',
    details2: 'Open to all',
    backgroundTheme: 'clean',
    priority: 5,
    active: true,
    tenant: tenant.id,
  },
})

await payload.create({
  collection: 'sponsor-slides',
  data: {
    title: 'Local Halal Market',
    tagline: 'Family-owned since 2008',
    layoutTemplate: 'logo-left',
    brandColorPrimary: '#1f6f43',
    priority: 4,
    active: true,
    tenant: tenant.id,
  },
})

await payload.create({
  collection: 'weekly-events-slides',
  data: {
    title: 'Weekly Schedule',
    entries: [
      { day: 'mon', time: '7:00 PM', name: 'Quran Class', location: 'Hall A' },
      { day: 'fri', time: '1:30 PM', name: 'Jumuah Khutbah', location: 'Main Hall' },
    ],
    active: true,
    tenant: tenant.id,
  },
})

await payload.create({
  collection: 'kiosks',
  data: { name: 'Lobby Display', location: 'Lobby', tenant: tenant.id },
})
```

- [ ] **Step 2: Run seed**

```
npm run seed
```

Expected: completes without error; new rows visible in admin.

- [ ] **Step 3: End-to-end smoke**

1. `npm run dev`
2. Open `/kiosk` → see pairing code.
3. Admin → Kiosks → Lobby Display → type code → save → see status flip to ONLINE.
4. Browser at `/kiosk` redirects to `/kiosk/<deviceId>`.
5. Slides rotate; prayer-times strip visible at bottom.
6. Edit a carousel slide; within 60s the kiosk picks it up.
7. Click "Push update to this kiosk" — kiosk picks it up on next poll.
8. Stop the kiosk page in browser; in 2–5 minutes the cron flips it to OFFLINE.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "chore(kiosk): seed sample kiosk content (#75)"
```

---

## Task 21: Final polish

**Files:**
- Modify: `src/app/(kiosk)/kiosk.css` (1920×1080 base sizing)
- Modify: `README.md` (kiosk section)

- [ ] **Step 1: Base sizing CSS**

Replace `src/app/(kiosk)/kiosk.css` with:

```css
:root {
  color-scheme: dark;
  --kiosk-width: 1920px;
  --kiosk-height: 1080px;
}

html, body, main {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #000;
  color: #fff;
}

/* Hide cursor on actual kiosk hardware */
.kiosk-fullscreen {
  cursor: none;
}
```

- [ ] **Step 2: Add a kiosk section to README**

Append to `README.md`:

```markdown
## Kiosk

OpenMasjid includes a tenant-scoped kiosk/display-monitor system. Each tenant can:

- Author **Carousel Slides**, **Sponsor Slides**, **Weekly Events Slides**, and a **QR-code library** in admin.
- Register physical **Kiosks**, pair them via a typed 6-character code, and optionally override the slide playlist per kiosk.
- Push immediate updates to one or all kiosks; otherwise kiosks poll every 60 seconds.

Display URL: `https://<tenant>.openmasjid.app/kiosk`

Spec: `docs/superpowers/specs/2026-05-14-kiosk-integration-design.md`
```

- [ ] **Step 3: Final typecheck + lint**

```
npx tsc --noEmit
npm run lint
npm test
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(kiosk\)/kiosk.css README.md
git commit -m "docs(kiosk): readme section and base CSS (#75)"
```

---

## Done

After Task 21, the work in the spec's v1 scope is complete. Out-of-scope features (monthly calendar slides, blackout-during-prayer, scheduled activation/deactivation, two-way commands, Announcements on kiosk, WebSocket/SSE) remain deferred to v2.
