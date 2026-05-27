# Prayer Display v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the kiosk prayer-times slide with the designer's three-variant 1920×1080 prayer display, add a Salah-in-progress takeover (auto + manual), and drive hero content from a new per-tenant content collection.

**Architecture:** The prayer display stays one carousel slide that picks a random variant + content entry on each appearance. Pure logic (selection, salah window, hijri, timetable) lives in unit-tested helpers under `src/lib/kiosk/`. A new per-tenant Payload collection feeds hero content, shipped to the kiosk inside the existing `/api/kiosk/state` payload. A kiosk-wide overlay renders the Salah takeover, triggered automatically from iqamah times or manually via a tenant-level flag set by a new admin endpoint.

**Tech Stack:** Next.js 16 (App Router), React, Payload CMS 3 (postgres), TypeScript, Vitest, next/font.

**Spec:** `docs/superpowers/specs/2026-05-26-prayer-display-v2-design.md`

---

## File Structure

**Create:**
- `src/collections/PrayerDisplayContent.ts` — per-tenant content collection
- `src/lib/kiosk/prayerContentSeeds.ts` — shared seed list + `ContentEntry` type
- `src/lib/kiosk/prayerDisplaySelection.ts` — `pickVariant`, `pickContent` (pure)
- `src/lib/kiosk/salahWindow.ts` — `computeSalahState` (pure)
- `src/lib/kiosk/prayerTimetable.ts` — `buildTimetable` incl. Friday jummah + next-prayer (pure)
- `src/lib/hijri.ts` — `formatHijri` (pure, `Intl`)
- `src/app/(kiosk)/_components/prayer-display/PrayerDisplay.tsx` — main slide component
- `src/app/(kiosk)/_components/prayer-display/SalahTakeover.tsx` — overlay
- `src/app/(kiosk)/_components/prayer-display/prayer-display.css` — ported styles
- `src/app/api/kiosk/salah/route.ts` — manual trigger/clear endpoint
- `src/admin/SalahControlBanner.tsx` — admin button to trigger/clear manual salah
- Tests under `tests/kiosk/`

**Modify:**
- `src/collections/Tenants.ts` — new fields
- `src/payload.config.ts` — register `PrayerDisplayContent`
- `src/lib/kiosk/composeState.ts` — add content pool + prayer-display config to state
- `src/app/api/kiosk/state/route.ts` — wire new fields into response
- `src/app/(kiosk)/kiosk/[deviceId]/page.tsx` — State type, dwell, render PrayerDisplay + overlay
- `src/app/(kiosk)/layout.tsx` — import prayer-display.css
- `src/lib/fonts.ts` — add Amiri Quran
- `src/collections/Kiosks.ts` — mount `SalahControlBanner`

**Delete (Task 16):**
- `src/app/(kiosk)/_components/PrayerTimesSlide.tsx`
- `src/app/(kiosk)/_components/IslamicContentDisplay.tsx`
- `src/app/(kiosk)/_lib/constants/islamicContent.ts`

---

## Shared types (defined once, used throughout)

```ts
// in src/lib/kiosk/prayerContentSeeds.ts
export type ContentKind = 'ayah' | 'hadith' | 'dua' | 'bismillah'
export interface ContentEntry {
  id: string
  kind: ContentKind
  arabic: string
  english: string
  citation: string
}

// in src/lib/kiosk/prayerDisplaySelection.ts
export type PrayerVariant = 'cream' | 'night' | 'mihrab'
```

---

## Task 1: Tenant fields

**Files:**
- Modify: `src/collections/Tenants.ts`

- [ ] **Step 1: Add the five new fields**

Find the `location` field group (around `src/collections/Tenants.ts:269`). Immediately AFTER the closing of the `location` group object (before the next top-level field), add a new `prayerDisplay` group field:

```ts
{
  name: 'prayerDisplay',
  type: 'group',
  label: 'Prayer Display',
  admin: {
    description: 'Settings for the kiosk prayer display (the lobby TV screen).',
  },
  fields: [
    {
      name: 'displayCity',
      type: 'text',
      label: 'Display city',
      admin: {
        description: 'Shown under the masjid name on the prayer display, e.g. "Plano, TX". Leave blank to hide.',
      },
    },
    {
      name: 'dwellSeconds',
      type: 'number',
      label: 'Prayer screen dwell (seconds)',
      defaultValue: 10,
      min: 5,
      max: 60,
      admin: {
        description: 'How long the prayer screen stays up before the carousel advances (5–60). Default 10.',
      },
    },
    {
      name: 'salahHoldoverMinutes',
      type: 'number',
      label: 'Salah holdover (minutes)',
      defaultValue: 15,
      min: 1,
      max: 90,
      admin: {
        description: 'How long the "Salah in progress" screen stays up after iqamah, for all prayers (1–90). Default 15.',
      },
    },
    {
      name: 'salahManualUntil',
      type: 'date',
      admin: {
        hidden: true,
        description: 'Set by the "Salah now" admin control; the takeover stays up until this time.',
      },
    },
    {
      name: 'salahManualClearedAt',
      type: 'date',
      admin: {
        hidden: true,
        description: 'Set by "End now"; clears an active manual takeover.',
      },
    },
  ],
},
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors from this file).

- [ ] **Step 3: Commit**

```bash
git add src/collections/Tenants.ts
git commit -m "feat(kiosk): add prayer-display tenant settings fields"
```

---

## Task 2: Content seed list + type

**Files:**
- Create: `src/lib/kiosk/prayerContentSeeds.ts`

- [ ] **Step 1: Create the seed file**

Port the existing entries from `src/app/(kiosk)/_lib/constants/islamicContent.ts` into the new flat `ContentEntry` shape (`reference`/`source` → `citation`), and prepend the Bismillah entry. Create `src/lib/kiosk/prayerContentSeeds.ts`:

```ts
export type ContentKind = 'ayah' | 'hadith' | 'dua' | 'bismillah'

export interface ContentEntry {
  id: string
  kind: ContentKind
  arabic: string
  english: string
  citation: string
}

export const PRAYER_CONTENT_SEEDS: ContentEntry[] = [
  {
    id: 'seed-bismillah',
    kind: 'bismillah',
    arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
    english: 'In the name of Allah, the Most Gracious, the Most Merciful',
    citation: '',
  },
  {
    id: 'seed-ayah-1',
    kind: 'ayah',
    arabic: 'وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ وَارْكَعُوا مَعَ الرَّاكِعِينَ',
    english: 'And establish prayer and give zakah and bow with those who bow.',
    citation: 'Al-Baqarah 2:43',
  },
  {
    id: 'seed-ayah-2',
    kind: 'ayah',
    arabic: 'وَالَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ لَهُمْ جَنَّاتٌ تَجْرِي مِن تَحْتِهَا الْأَنْهَارُ',
    english: 'And those who believe and do righteous deeds will have gardens beneath which rivers flow.',
    citation: 'Al-Baqarah 2:25',
  },
  {
    id: 'seed-ayah-3',
    kind: 'ayah',
    arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    english: 'Indeed, with hardship comes ease.',
    citation: 'Ash-Sharh 94:6',
  },
  {
    id: 'seed-ayah-4',
    kind: 'ayah',
    arabic: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا',
    english: 'And whoever fears Allah - He will make for him a way out.',
    citation: 'At-Talaq 65:2',
  },
  {
    id: 'seed-ayah-5',
    kind: 'ayah',
    arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ',
    english: 'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
    citation: 'Al-Baqarah 2:152',
  },
  {
    id: 'seed-ayah-6',
    kind: 'ayah',
    arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    english: 'Verily, in the remembrance of Allah do hearts find rest.',
    citation: "Ar-Ra'd 13:28",
  },
  {
    id: 'seed-ayah-7',
    kind: 'ayah',
    arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    english: 'Allah does not burden a soul beyond that it can bear.',
    citation: 'Al-Baqarah 2:286',
  },
  {
    id: 'seed-ayah-8',
    kind: 'ayah',
    arabic: 'وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا',
    english: 'And those who strive for Us - We will surely guide them to Our ways.',
    citation: 'Al-Ankabut 29:69',
  },
  {
    id: 'seed-hadith-1',
    kind: 'hadith',
    arabic: 'الصَّلَوَاتُ الْخَمْسُ وَالْجُمُعَةُ إِلَى الْجُمُعَةِ كَفَّارَةٌ لِمَا بَيْنَهُنَّ',
    english: 'The five prayers and Friday prayer to Friday prayer are expiation for what is between them.',
    citation: 'Sahih Muslim',
  },
  {
    id: 'seed-hadith-2',
    kind: 'hadith',
    arabic: 'خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ',
    english: 'The best of people are those who are most beneficial to others.',
    citation: "Al-Mu'jam al-Awsat",
  },
  {
    id: 'seed-hadith-3',
    kind: 'hadith',
    arabic: 'مَنْ كَانَ فِي حَاجَةِ أَخِيهِ كَانَ اللَّهُ فِي حَاجَتِهِ',
    english: 'Whoever fulfills the needs of his brother, Allah will fulfill his needs.',
    citation: 'Sahih Bukhari',
  },
  {
    id: 'seed-hadith-4',
    kind: 'hadith',
    arabic: 'الدِّينُ النَّصِيحَةُ',
    english: 'Religion is sincere advice.',
    citation: 'Sahih Muslim',
  },
  {
    id: 'seed-hadith-5',
    kind: 'hadith',
    arabic: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ',
    english: 'Your smile in the face of your brother is charity.',
    citation: "Jami' at-Tirmidhi",
  },
  {
    id: 'seed-hadith-6',
    kind: 'hadith',
    arabic: 'الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ',
    english:
      'The strong believer is better and more beloved to Allah than the weak believer, and in each there is good.',
    citation: 'Sahih Muslim',
  },
  {
    id: 'seed-hadith-7',
    kind: 'hadith',
    arabic: 'يَسِّرُوا وَلَا تُعَسِّرُوا وَبَشِّرُوا وَلَا تُنَفِّرُوا',
    english: 'Make things easy and do not make them difficult. Give glad tidings and do not drive people away.',
    citation: 'Sahih Bukhari',
  },
  {
    id: 'seed-hadith-8',
    kind: 'hadith',
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    english: 'None of you truly believes until he loves for his brother what he loves for himself.',
    citation: 'Sahih Bukhari',
  },
  {
    id: 'seed-hadith-9',
    kind: 'hadith',
    arabic: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    english: 'The most beloved deeds to Allah are those done consistently, even if they are small.',
    citation: 'Sahih Bukhari',
  },
]
```

- [ ] **Step 2: Typecheck & commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add src/lib/kiosk/prayerContentSeeds.ts
git commit -m "feat(kiosk): prayer-display content seed list + ContentEntry type"
```

---

## Task 3: PrayerDisplayContent collection

**Files:**
- Create: `src/collections/PrayerDisplayContent.ts`
- Modify: `src/payload.config.ts`

- [ ] **Step 1: Create the collection**

Mirror the access/hook pattern from `src/collections/CarouselSlides.ts`. Create `src/collections/PrayerDisplayContent.ts`:

```ts
import type { CollectionConfig } from 'payload'
import {
  tenantScopedCreate,
  tenantScopedDelete,
  tenantScopedRead,
  tenantScopedUpdate,
} from '../access/tenantScoped'
import { setTenantFromUser } from '../hooks/setTenantFromUser'
import { bumpKioskBroadcast } from '../hooks/bumpKioskBroadcast'

export const PrayerDisplayContent: CollectionConfig = {
  slug: 'prayer-display-content',
  labels: { singular: 'Prayer Display Content', plural: 'Prayer Display Content' },
  admin: {
    group: 'Kiosk',
    hideAPIURL: true,
    useAsTitle: 'english',
    defaultColumns: ['english', 'kind', 'active'],
    description:
      'Verses, hadith, and du’as shown in the hero of the prayer display. Any entry can appear on any of the three looks. Changes auto-broadcast to kiosks on save.',
  },
  access: {
    read: tenantScopedRead,
    create: tenantScopedCreate,
    update: tenantScopedUpdate,
    delete: tenantScopedDelete,
  },
  hooks: {
    beforeChange: [setTenantFromUser],
    afterChange: [bumpKioskBroadcast],
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'ayah',
      options: [
        { label: 'Ayah (Qur’an)', value: 'ayah' },
        { label: 'Hadith', value: 'hadith' },
        { label: "Du’a", value: 'dua' },
        { label: 'Bismillah', value: 'bismillah' },
      ],
      admin: { description: 'A label only — it drives the small eyebrow text, not which look shows it.' },
    },
    {
      name: 'arabic',
      type: 'textarea',
      required: true,
      admin: { description: 'Arabic text with diacritics. Required.' },
    },
    {
      name: 'english',
      type: 'textarea',
      required: true,
      label: 'English translation',
      admin: { description: 'Required.' },
    },
    {
      name: 'citation',
      type: 'text',
      admin: { description: 'Free-form, e.g. "Surah An-Nisāʾ · 4:103" or "Ṣaḥīḥ al-Bukhārī".' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Off → removed from the rotation pool immediately on save.' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        condition: (_, __, { user }) =>
          (user as { role?: string } | null)?.role === 'platformOwner',
      },
      access: {
        update: ({ req: { user } }) => user?.role === 'platformOwner',
      },
    },
  ],
}
```

- [ ] **Step 2: Register in payload config**

In `src/payload.config.ts`, add the import next to the other collection imports (after line 25, `PrayerSchedules`):

```ts
import { PrayerDisplayContent } from './collections/PrayerDisplayContent'
```

Then add `PrayerDisplayContent,` to the `collections: [` array (near `PrayerSchedules,` at line ~122):

```ts
  collections: [
    PrayerSchedules,
    PrayerDisplayContent,
    // ...existing entries
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/collections/PrayerDisplayContent.ts src/payload.config.ts
git commit -m "feat(kiosk): add prayer-display-content collection"
```

---

## Task 4: Migration

**Files:**
- Create: `src/migrations/<generated>.ts` (Payload generates the filename)

- [ ] **Step 1: Generate the migration**

Run: `npm run payload migrate:create prayer_display_v2`
Expected: a new file appears in `src/migrations/` adding the `prayer_display_content` table and the new `prayerDisplay_*` tenant columns.

- [ ] **Step 2: Apply it**

Run: `npm run payload migrate`
Expected: migration applies with no error; "Done" / up-to-date.

- [ ] **Step 3: Commit**

```bash
git add src/migrations
git commit -m "feat(kiosk): migration for prayer-display content + tenant fields"
```

---

## Task 5: Variant + content selection helpers (TDD)

**Files:**
- Create: `src/lib/kiosk/prayerDisplaySelection.ts`
- Test: `tests/kiosk/prayerDisplaySelection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { pickVariant, pickContent, VARIANTS } from '@/lib/kiosk/prayerDisplaySelection'
import type { ContentEntry } from '@/lib/kiosk/prayerContentSeeds'

const entry = (id: string): ContentEntry => ({
  id, kind: 'ayah', arabic: 'a', english: 'e', citation: 'c',
})

describe('pickVariant', () => {
  it('returns a valid variant', () => {
    expect(VARIANTS).toContain(pickVariant(null))
  })
  it('never repeats the previous variant', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickVariant('cream')).not.toBe('cream')
      expect(pickVariant('night')).not.toBe('night')
      expect(pickVariant('mihrab')).not.toBe('mihrab')
    }
  })
})

describe('pickContent', () => {
  const pool = [entry('1'), entry('2'), entry('3')]
  it('returns null for an empty pool', () => {
    expect(pickContent([], [])).toBeNull()
  })
  it('avoids ids already seen this session', () => {
    const picked = pickContent(pool, ['1', '2'])
    expect(picked?.id).toBe('3')
  })
  it('falls back to the full pool once everything has been seen', () => {
    const picked = pickContent(pool, ['1', '2', '3'])
    expect(picked).not.toBeNull()
    expect(['1', '2', '3']).toContain(picked!.id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kiosk/prayerDisplaySelection.test.ts`
Expected: FAIL ("Cannot find module '@/lib/kiosk/prayerDisplaySelection'").

- [ ] **Step 3: Implement**

Create `src/lib/kiosk/prayerDisplaySelection.ts`:

```ts
import type { ContentEntry } from './prayerContentSeeds'

export type PrayerVariant = 'cream' | 'night' | 'mihrab'

export const VARIANTS: PrayerVariant[] = ['cream', 'night', 'mihrab']

export function pickVariant(previous: PrayerVariant | null): PrayerVariant {
  const candidates = previous ? VARIANTS.filter((v) => v !== previous) : VARIANTS
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export function pickContent(pool: ContentEntry[], seenIds: string[]): ContentEntry | null {
  if (pool.length === 0) return null
  const seen = new Set(seenIds)
  const unseen = pool.filter((e) => !seen.has(e.id))
  const candidates = unseen.length > 0 ? unseen : pool
  return candidates[Math.floor(Math.random() * candidates.length)]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kiosk/prayerDisplaySelection.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk/prayerDisplaySelection.ts tests/kiosk/prayerDisplaySelection.test.ts
git commit -m "feat(kiosk): variant + content selection helpers"
```

---

## Task 6: Salah window helper (TDD)

**Files:**
- Create: `src/lib/kiosk/salahWindow.ts`
- Test: `tests/kiosk/salahWindow.test.ts`

The display polls every 5s and re-evaluates. `computeSalahState` decides, for a given `now`, whether the takeover should be showing.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { computeSalahState, type IqamahPoint } from '@/lib/kiosk/salahWindow'

// 2026-05-26 is a Tuesday. Use local-time Date objects.
const at = (h: number, m: number) => new Date(2026, 4, 26, h, m, 0)

const iqamahs: IqamahPoint[] = [
  { name: 'Fajr', label: '5:45 AM', minutes: 5 * 60 + 45 },
  { name: 'Maghrib', label: '8:33 PM', minutes: 20 * 60 + 33 },
]

describe('computeSalahState (auto)', () => {
  it('is inactive before any iqamah', () => {
    const s = computeSalahState({ now: at(5, 0), iqamahs, holdoverMinutes: 15, manualUntil: null, manualClearedAt: null })
    expect(s.active).toBe(false)
  })
  it('is active during the holdover after iqamah', () => {
    const s = computeSalahState({ now: at(5, 50), iqamahs, holdoverMinutes: 15, manualUntil: null, manualClearedAt: null })
    expect(s.active).toBe(true)
    expect(s.prayerName).toBe('Fajr')
    expect(s.iqamahLabel).toBe('5:45 AM')
  })
  it('clears after the holdover elapses', () => {
    const s = computeSalahState({ now: at(6, 1), iqamahs, holdoverMinutes: 15, manualUntil: null, manualClearedAt: null })
    expect(s.active).toBe(false)
  })
})

describe('computeSalahState (manual)', () => {
  it('is active while now < manualUntil', () => {
    const now = at(14, 0)
    const manualUntil = at(14, 10).toISOString()
    const s = computeSalahState({ now, iqamahs, holdoverMinutes: 15, manualUntil, manualClearedAt: null })
    expect(s.active).toBe(true)
  })
  it('is cleared when manualClearedAt is after the trigger', () => {
    const now = at(14, 5)
    const manualUntil = at(14, 10).toISOString()
    const manualClearedAt = at(14, 3).toISOString()
    const s = computeSalahState({ now, iqamahs, holdoverMinutes: 15, manualUntil, manualClearedAt })
    expect(s.active).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kiosk/salahWindow.test.ts`
Expected: FAIL ("Cannot find module '@/lib/kiosk/salahWindow'").

- [ ] **Step 3: Implement**

Create `src/lib/kiosk/salahWindow.ts`:

```ts
export interface IqamahPoint {
  name: string
  label: string // human display, e.g. "5:45 AM"
  minutes: number // minutes since local midnight
}

export interface SalahStateArgs {
  now: Date
  iqamahs: IqamahPoint[]
  holdoverMinutes: number
  manualUntil: string | null
  manualClearedAt: string | null
}

export interface SalahState {
  active: boolean
  prayerName: string | null
  iqamahLabel: string | null
}

const INACTIVE: SalahState = { active: false, prayerName: null, iqamahLabel: null }

export function computeSalahState(args: SalahStateArgs): SalahState {
  const { now, iqamahs, holdoverMinutes, manualUntil, manualClearedAt } = args

  // Manual takeover takes precedence: active while now is before manualUntil,
  // unless an explicit "End now" (manualClearedAt) happened at/after the trigger.
  if (manualUntil) {
    const until = new Date(manualUntil).getTime()
    const triggeredAt = until - holdoverMinutes * 60_000
    const cleared = manualClearedAt ? new Date(manualClearedAt).getTime() : null
    const wasCleared = cleared !== null && cleared >= triggeredAt
    if (now.getTime() < until && !wasCleared) {
      return { active: true, prayerName: null, iqamahLabel: null }
    }
  }

  // Auto: within holdover minutes after any prayer's iqamah.
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  for (const p of iqamahs) {
    if (nowMin >= p.minutes && nowMin < p.minutes + holdoverMinutes) {
      return { active: true, prayerName: p.name, iqamahLabel: p.label }
    }
  }
  return INACTIVE
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kiosk/salahWindow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk/salahWindow.ts tests/kiosk/salahWindow.test.ts
git commit -m "feat(kiosk): salah takeover window computation"
```

---

## Task 7: Timetable + next-prayer helper (TDD)

**Files:**
- Create: `src/lib/kiosk/prayerTimetable.ts`
- Test: `tests/kiosk/prayerTimetable.test.ts`

Extracts and generalizes the time parsing + next-prayer logic from the old `PrayerTimesSlide.tsx`, and adds Friday jummah substitution for the Dhuhr column.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { parseTimeToMinutes, buildTimetable, type DayData } from '@/lib/kiosk/prayerTimetable'

const day: DayData = {
  fajr: { adhan: '5:01 AM', iqamah: '5:45 AM' },
  zuhr: { adhan: '1:25 PM', iqamah: '2:00 PM' },
  asr: { adhan: '5:08 PM', iqamah: '6:20 PM' },
  maghrib: { adhan: '8:28 PM', iqamah: '8:33 PM' },
  isha: { adhan: '9:48 PM', iqamah: '10:00 PM' },
}

describe('parseTimeToMinutes', () => {
  it('parses 12h am/pm', () => {
    expect(parseTimeToMinutes('5:45 AM')).toBe(5 * 60 + 45)
    expect(parseTimeToMinutes('2:00 PM')).toBe(14 * 60)
    expect(parseTimeToMinutes('12:00 AM')).toBe(0)
    expect(parseTimeToMinutes('12:30 PM')).toBe(12 * 60 + 30)
  })
  it('returns null for junk', () => {
    expect(parseTimeToMinutes('')).toBeNull()
    expect(parseTimeToMinutes(undefined)).toBeNull()
  })
})

describe('buildTimetable', () => {
  it('produces 5 columns in order with the next-prayer key', () => {
    const t = buildTimetable({ day, now: new Date(2026, 4, 26, 14, 30), isFriday: false, jummahTimes: [] })
    expect(t.entries.map((e) => e.key)).toEqual(['fajr', 'zuhr', 'asr', 'maghrib', 'isha'])
    expect(t.nextKey).toBe('asr') // 2:30pm → next adhan is Asr 5:08pm
  })
  it('rolls next to fajr after isha', () => {
    const t = buildTimetable({ day, now: new Date(2026, 4, 26, 23, 0), isFriday: false, jummahTimes: [] })
    expect(t.nextKey).toBe('fajr')
  })
  it('substitutes the first jummah time into the zuhr iqamah on Friday', () => {
    const t = buildTimetable({ day, now: new Date(2026, 4, 29, 11, 0), isFriday: true, jummahTimes: ['1:30 PM'] })
    const zuhr = t.entries.find((e) => e.key === 'zuhr')!
    expect(zuhr.iqamah).toBe('1:30 PM')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kiosk/prayerTimetable.test.ts`
Expected: FAIL ("Cannot find module '@/lib/kiosk/prayerTimetable'").

- [ ] **Step 3: Implement**

Create `src/lib/kiosk/prayerTimetable.ts`:

```ts
export type PrayerKey = 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha'

export interface Cell { adhan?: string; iqamah?: string }
export type DayData = Record<PrayerKey, Cell | undefined>

export interface TimetableEntry {
  key: PrayerKey
  en: string
  ar: string
  adhan?: string
  iqamah?: string
}

const META: { key: PrayerKey; en: string; ar: string }[] = [
  { key: 'fajr', en: 'Fajr', ar: 'ٱلْفَجْر' },
  { key: 'zuhr', en: 'Dhuhr', ar: 'ٱلظُّهْر' },
  { key: 'asr', en: 'Asr', ar: 'ٱلْعَصْر' },
  { key: 'maghrib', en: 'Maghrib', ar: 'ٱلْمَغْرِب' },
  { key: 'isha', en: 'Isha', ar: 'ٱلْعِشَاء' },
]

export function parseTimeToMinutes(raw: string | undefined): number | null {
  if (!raw) return null
  const m = /(\d{1,2}):(\d{2})\s*([ap]m)?/i.exec(raw)
  if (!m) return null
  let h = Number(m[1])
  const minutes = Number(m[2])
  const ampm = m[3]?.toLowerCase()
  if (ampm === 'pm' && h !== 12) h += 12
  if (ampm === 'am' && h === 12) h = 0
  return h * 60 + minutes
}

export function buildTimetable(args: {
  day: DayData
  now: Date
  isFriday: boolean
  jummahTimes: string[]
}): { entries: TimetableEntry[]; nextKey: PrayerKey | null } {
  const { day, now, isFriday, jummahTimes } = args

  const entries: TimetableEntry[] = META.map((meta) => {
    const cell = day[meta.key]
    let iqamah = cell?.iqamah
    if (meta.key === 'zuhr' && isFriday && jummahTimes.length > 0) {
      iqamah = jummahTimes[0]
    }
    return { key: meta.key, en: meta.en, ar: meta.ar, adhan: cell?.adhan, iqamah }
  })

  const nowMin = now.getHours() * 60 + now.getMinutes()
  let nextKey: PrayerKey | null = null
  for (const e of entries) {
    const min = parseTimeToMinutes(e.adhan)
    if (min !== null && min > nowMin) {
      nextKey = e.key
      break
    }
  }
  if (nextKey === null && entries.length > 0) nextKey = entries[0].key
  return { entries, nextKey }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kiosk/prayerTimetable.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/kiosk/prayerTimetable.ts tests/kiosk/prayerTimetable.test.ts
git commit -m "feat(kiosk): prayer timetable + next-prayer helper with friday jummah"
```

---

## Task 8: Hijri formatter (TDD)

**Files:**
- Create: `src/lib/hijri.ts`
- Test: `tests/kiosk/hijri.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { formatHijri } from '@/lib/hijri'

describe('formatHijri', () => {
  it('returns a non-empty string containing a 4-digit hijri year', () => {
    const out = formatHijri(new Date(2026, 4, 26), 'America/Chicago')
    expect(typeof out).toBe('string')
    expect(out).toMatch(/1\d{3}/) // hijri year ~14xx
  })
  it('does not throw on a bad timezone (falls back to UTC)', () => {
    expect(() => formatHijri(new Date(2026, 4, 26), 'Not/AZone')).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kiosk/hijri.test.ts`
Expected: FAIL ("Cannot find module '@/lib/hijri'").

- [ ] **Step 3: Implement**

Create `src/lib/hijri.ts`:

```ts
/**
 * Format a date as a Hijri (islamic-umalqura) date string, e.g.
 * "19 Shawwāl 1447". Client-safe (uses Intl only). Falls back to UTC if the
 * provided timezone is invalid.
 */
export function formatHijri(date: Date, timezone: string): string {
  const make = (tz: string | undefined) =>
    new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: tz,
    })
  try {
    return make(timezone).format(date).replace(/\s*AH$/, '')
  } catch {
    return make(undefined).format(date).replace(/\s*AH$/, '')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kiosk/hijri.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hijri.ts tests/kiosk/hijri.test.ts
git commit -m "feat: client-safe hijri date formatter"
```

---

## Task 9: Wire content pool + prayer-display config into kiosk state

**Files:**
- Modify: `src/lib/kiosk/composeState.ts`
- Modify: `src/app/api/kiosk/state/route.ts`
- Test: `tests/kiosk/composeState.prayerDisplay.test.ts`

- [ ] **Step 1: Write the failing test** (pure portion: content pool falls back to seeds)

Add a small pure helper `resolveContentPool` to `composeState.ts` and test it.

```ts
import { describe, it, expect } from 'vitest'
import { resolveContentPool } from '@/lib/kiosk/composeState'
import { PRAYER_CONTENT_SEEDS } from '@/lib/kiosk/prayerContentSeeds'

describe('resolveContentPool', () => {
  it('maps active docs to ContentEntry shape', () => {
    const pool = resolveContentPool([
      { id: 7, kind: 'ayah', arabic: 'a', english: 'e', citation: 'c', active: true },
    ] as any)
    expect(pool).toEqual([{ id: '7', kind: 'ayah', arabic: 'a', english: 'e', citation: 'c' }])
  })
  it('drops inactive docs', () => {
    const pool = resolveContentPool([
      { id: 1, kind: 'ayah', arabic: 'a', english: 'e', citation: '', active: false },
    ] as any)
    expect(pool).toEqual([])
  })
  it('falls back to seeds when no active docs', () => {
    expect(resolveContentPool([])).toEqual(PRAYER_CONTENT_SEEDS)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kiosk/composeState.prayerDisplay.test.ts`
Expected: FAIL ("resolveContentPool is not exported").

- [ ] **Step 3: Implement the helper + extend compose**

In `src/lib/kiosk/composeState.ts` add the import and helper, and extend the returned data. At top:

```ts
import { PRAYER_CONTENT_SEEDS, type ContentEntry } from './prayerContentSeeds'
```

Add the exported helper:

```ts
export function resolveContentPool(docs: any[]): ContentEntry[] {
  const active = docs
    .filter((d) => d?.active)
    .map((d) => ({
      id: String(d.id),
      kind: d.kind,
      arabic: d.arabic ?? '',
      english: d.english ?? '',
      citation: d.citation ?? '',
    })) as ContentEntry[]
  return active.length > 0 ? active : PRAYER_CONTENT_SEEDS
}
```

Add `prayer-display-content` to the parallel `Promise.all` query block and include the pool + updatedAts in the return. Extend the function's return type to `{ slides; tenant; contentPool: ContentEntry[]; contentUpdatedAts: string[] }`. Add this query alongside the others:

```ts
    payload.find({
      collection: 'prayer-display-content',
      where: { tenant: { equals: tenantId } },
      limit: 200,
      overrideAccess: true,
    }),
```

(destructure it as `content` in the `const [carousel, sponsors, weekly, tenantDoc, content] = ...`).

At the end, build and return the pool:

```ts
  const contentPool = resolveContentPool(content.docs)
  const contentUpdatedAts = content.docs.map((d: any) => d.updatedAt ?? '')

  return { slides, tenant, contentPool, contentUpdatedAts }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/kiosk/composeState.prayerDisplay.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the route response**

In `src/app/api/kiosk/state/route.ts`, after the `composeKioskState` call, destructure the new fields and read the tenant's `prayerDisplay` group. The `tenantDoc` is already fetched (line ~45). Replace the existing `const { slides, tenant } = await composeKioskState(...)` with:

```ts
  const { slides, tenant, contentPool, contentUpdatedAts } = await composeKioskState({
    payload: payload as any,
    tenantId: String(tenantId),
    now,
    overrideIds,
    broadcastAt,
    pushAt,
  })

  const pd = (tenantDoc as any).prayerDisplay ?? {}
```

Fold content updatedAts into the version hash so content edits invalidate caches even if `kioskBroadcastAt` did not change. Update the `versionHash` call:

```ts
  const version = versionHash({
    slideIds: [...slides.map((s) => `${s.type}:${s.id}`), 'prayer-schedule', ...contentPool.map((c) => c.id)],
    slideUpdatedAts: [...slides.map((s) => s.updatedAt), scheduleUpdatedAt, ...contentUpdatedAts],
    day: dayKey,
    broadcastAt,
    pushAt,
  })
```

Extend the final JSON response with a `prayerDisplay` object:

```ts
  return NextResponse.json({
    tenant,
    prayerTimes,
    slides,
    version,
    pollIntervalMs: 5_000,
    prayerDisplay: {
      dwellSeconds: Number(pd.dwellSeconds ?? 10),
      displayCity: pd.displayCity ?? null,
      salahHoldoverMinutes: Number(pd.salahHoldoverMinutes ?? 15),
      salahManualUntil: pd.salahManualUntil ?? null,
      salahManualClearedAt: pd.salahManualClearedAt ?? null,
      contentPool,
    },
  })
```

- [ ] **Step 6: Typecheck + full test run**

Run: `npx tsc --noEmit && npx vitest run tests/kiosk`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/kiosk/composeState.ts src/app/api/kiosk/state/route.ts tests/kiosk/composeState.prayerDisplay.test.ts
git commit -m "feat(kiosk): ship content pool + prayer-display config in state payload"
```

---

## Task 10: Port CSS + Amiri Quran font

**Files:**
- Create: `src/app/(kiosk)/_components/prayer-display/prayer-display.css`
- Modify: `src/lib/fonts.ts`
- Modify: `src/app/(kiosk)/layout.tsx`

- [ ] **Step 1: Copy the designer CSS verbatim**

Copy the file `OpenMasjid (1)/prayer-display/variants.css` to `src/app/(kiosk)/_components/prayer-display/prayer-display.css` verbatim, then make exactly two edits:

1. **Delete** the Google Fonts `@import url(...)` line at the top (we load fonts via next/font instead).
2. At the very top, add a block mapping the designer's font variables to the kiosk's next/font CSS variables:

```css
.pd-screen {
  --pd-fraunces: var(--font-fraunces), serif;
  --pd-inter: var(--font-inter), system-ui, sans-serif;
  --pd-amiri: var(--font-amiri), serif;
  --pd-quran: var(--font-amiri-quran), serif;
}
```

(The existing `.pd-screen { ... }` rule from the source stays; this block adds the variables it references.)

- [ ] **Step 2: Add Amiri Quran to fonts.ts**

Read `src/lib/fonts.ts` to match the existing `next/font/google` pattern. Add an `amiriQuran` export mirroring the existing `amiri` declaration, with `variable: '--font-amiri-quran'`, `weight: '400'`, `subsets: ['arabic']`. Confirm the existing `fraunces`/`inter`/`amiri` exports already declare `--font-fraunces` / `--font-inter` / `--font-amiri` variables (used in Step 1).

- [ ] **Step 3: Wire fonts + CSS into the kiosk layout**

In `src/app/(kiosk)/layout.tsx`:
- import the css: `import './_components/prayer-display/prayer-display.css'`
- import `amiriQuran` from `@/lib/fonts`
- add `amiriQuran.variable` to the `cn(...)` className list on `<html>`.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/(kiosk)/_components/prayer-display/prayer-display.css src/lib/fonts.ts "src/app/(kiosk)/layout.tsx"
git commit -m "feat(kiosk): port prayer-display CSS + load Amiri Quran font"
```

---

## Task 11: PrayerDisplay component

**Files:**
- Create: `src/app/(kiosk)/_components/prayer-display/PrayerDisplay.tsx`

Renders one variant frame: topbar, hero (generic shape, kind-driven eyebrow), and timetable. Markup classes match the ported CSS (`.pd-screen .pd-<variant>`, `.pd-topbar`, `.pd-hero`, `.pd-timetable`, `.pd-prayer`, `.is-next`, `.pd-next-tag`) from `variants.jsx`.

- [ ] **Step 1: Implement**

```tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { PrayerVariant } from '@/lib/kiosk/prayerDisplaySelection'
import type { ContentEntry } from '@/lib/kiosk/prayerContentSeeds'
import { buildTimetable, parseTimeToMinutes, type DayData } from '@/lib/kiosk/prayerTimetable'
import { formatHijri } from '@/lib/hijri'

const EYEBROW: Record<ContentEntry['kind'], string | null> = {
  ayah: 'Ayah of the day',
  hadith: 'Hadith',
  dua: "Du’a",
  bismillah: null,
}

function fmtClock(d: Date) {
  let h = d.getHours()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return { hm: `${h}:${m}`, ampm }
}

export interface PrayerDisplayProps {
  variant: PrayerVariant
  content: ContentEntry | null
  day: DayData | null
  venueName: string
  displayCity: string | null
  timezone: string
}

export default function PrayerDisplay({
  variant, content, day, venueName, displayCity, timezone,
}: PrayerDisplayProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const isFriday = now.getDay() === 5
  const timetable = useMemo(
    () => (day ? buildTimetable({ day, now, isFriday, jummahTimes: [] }) : { entries: [], nextKey: null }),
    [day, now, isFriday],
  )

  const clock = fmtClock(now)
  const hijri = formatHijri(now, timezone)
  const greg = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone,
  }).format(now)

  const eyebrow = content ? EYEBROW[content.kind] : null

  return (
    <div className={`pd-screen pd-${variant}`}>
      <div className="pd-topbar">
        <div className="pd-tb-venue">
          <div className="pd-tb-name">{venueName}</div>
          {displayCity && <div className="pd-tb-city">{displayCity}</div>}
        </div>
        <div className="pd-tb-right">
          <div className="pd-tb-clock">{clock.hm}<sup>{clock.ampm}</sup></div>
          <div className="pd-tb-dates">
            {hijri}
            <span className="pd-dot" />
            {greg}
          </div>
        </div>
      </div>

      <div className="pd-hero">
        {eyebrow && <div className="pd-verse-eyebrow">{eyebrow}</div>}
        {content && (
          <>
            <div className="pd-hero-arabic" dir="rtl">{content.arabic}</div>
            <div className="pd-hero-english">{content.english}</div>
            {content.citation && <div className="pd-hero-cite">{content.citation}</div>}
          </>
        )}
      </div>

      <div className="pd-timetable">
        {timetable.entries.map((p) => {
          const isNext = p.key === timetable.nextKey
          const adhanMin = parseTimeToMinutes(p.adhan)
          const ampm = adhanMin !== null && adhanMin >= 12 * 60 ? 'pm' : 'am'
          const adhanHM = p.adhan ? p.adhan.replace(/\s*[ap]m$/i, '') : '—'
          return (
            <div key={p.key} className={`pd-prayer${isNext ? ' is-next' : ''}`}>
              {isNext && <div className="pd-next-tag">Next</div>}
              <div className="pd-prayer-ar">{p.ar}</div>
              <div className="pd-prayer-name">{p.en}</div>
              <div className="pd-prayer-adhan">{adhanHM}<sup>{ampm}</sup></div>
              <div className="pd-prayer-iqamah">Iqamah · {p.iqamah ? p.iqamah.replace(/\s*[AP]M$/i, '') : '—'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

> NOTE on hero classes: the ported CSS scopes hero text under variant-specific selectors (`.pd-cream .pd-bismillah`, `.pd-night .pd-verse`, `.pd-mihrab .pd-hadith-ar`). Because we use one generic hero (`.pd-hero-arabic` / `.pd-hero-english` / `.pd-hero-cite`), add three small alias rules to `prayer-display.css` so each variant styles the generic classes — copy the font-size/color/line-height declarations from the corresponding variant-specific hero rules onto `.pd-<variant> .pd-hero-arabic`, `.pd-<variant> .pd-hero-english`, `.pd-<variant> .pd-hero-cite`. Do this as part of this task.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(kiosk)/_components/prayer-display/PrayerDisplay.tsx" "src/app/(kiosk)/_components/prayer-display/prayer-display.css"
git commit -m "feat(kiosk): PrayerDisplay variant component"
```

---

## Task 12: SalahTakeover overlay

**Files:**
- Create: `src/app/(kiosk)/_components/prayer-display/SalahTakeover.tsx`

Markup matches `VariantSalah` / `.pd-salah*` classes from `variants.jsx`/`variants.css`.

- [ ] **Step 1: Implement**

```tsx
'use client'

import React from 'react'

export interface SalahTakeoverProps {
  prayerName: string | null
  iqamahLabel: string | null
}

export default function SalahTakeover({ prayerName, iqamahLabel }: SalahTakeoverProps) {
  const header =
    prayerName && iqamahLabel
      ? `Now praying — ${prayerName} · Iqamah ${iqamahLabel}`
      : 'Now praying'
  return (
    <div
      className="pd-screen pd-salah"
      style={{ position: 'absolute', inset: 0, zIndex: 40 }}
    >
      <div className="pd-salah-prayer">{header}</div>
      <div className="pd-salah-ornament">۞ ۞ ۞</div>
      <div className="pd-salah-call">حَيَّ عَلى ٱلصَّلاة</div>
      <div className="pd-salah-title">Salah is in progress</div>
      <div className="pd-salah-sub">Please silence your phone</div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS.

```bash
git add "src/app/(kiosk)/_components/prayer-display/SalahTakeover.tsx"
git commit -m "feat(kiosk): salah takeover overlay component"
```

---

## Task 13: Wire into the kiosk display page

**Files:**
- Modify: `src/app/(kiosk)/kiosk/[deviceId]/page.tsx`

- [ ] **Step 1: Update the State type**

Replace the `State` type (lines ~18-24) to add `prayerDisplay`:

```ts
import type { ContentEntry } from '@/lib/kiosk/prayerContentSeeds'

type State = {
  tenant: { id: string; name: string; logo: string | null; timezone: string }
  prayerTimes: any
  slides: Slide[]
  version: string
  pollIntervalMs: number
  prayerDisplay: {
    dwellSeconds: number
    displayCity: string | null
    salahHoldoverMinutes: number
    salahManualUntil: string | null
    salahManualClearedAt: string | null
    contentPool: ContentEntry[]
  }
}
```

- [ ] **Step 2: Replace the imports and add selection state**

Replace `import PrayerTimesSlide from '../../_components/PrayerTimesSlide'` with:

```ts
import PrayerDisplay from '../../_components/prayer-display/PrayerDisplay'
import SalahTakeover from '../../_components/prayer-display/SalahTakeover'
import { pickVariant, pickContent, type PrayerVariant } from '@/lib/kiosk/prayerDisplaySelection'
import { computeSalahState, type IqamahPoint } from '@/lib/kiosk/salahWindow'
import { parseTimeToMinutes, type DayData } from '@/lib/kiosk/prayerTimetable'
```

Inside the component, add state for the current variant/content and the session-seen ids:

```ts
  const [variant, setVariant] = useState<PrayerVariant>('cream')
  const [content, setContent] = useState<ContentEntry | null>(null)
  const seenRef = useRef<string[]>([])
```

- [ ] **Step 3: Use the configurable dwell**

Change the injected prayer slide duration (line ~157) to read from state, defaulting to 10s:

```ts
  const dwellMs = (state?.prayerDisplay?.dwellSeconds ?? 10) * 1000
  const slidesWithPrayer = useMemo<CarouselSlide[]>(
    () => [
      { id: 'prayer-times', type: 'prayer-times', durationMs: dwellMs, payload: {} },
      ...(state?.slides ?? []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slidesKey, state?.slides.length, dwellMs],
  )
```

- [ ] **Step 4: Pick a new variant + content each time prayer-times becomes active**

Wrap the existing `reportCurrentSlide` callback (or add alongside it) so the prayer slide re-rolls on activation. In the `onSlideChange` handler passed to `CarouselLayout`, when `slide.type === 'prayer-times'`, run:

```ts
  const onSlideChange = useCallback(
    (slide: CarouselSlide, index: number) => {
      reportCurrentSlide(slide, index)
      if (slide.type === 'prayer-times') {
        setVariant((prev) => pickVariant(prev))
        const pool = state?.prayerDisplay?.contentPool ?? []
        const next = pickContent(pool, seenRef.current)
        if (next) {
          seenRef.current = [...seenRef.current, next.id]
          setContent(next)
        }
      }
    },
    [reportCurrentSlide, state?.prayerDisplay?.contentPool],
  )
```

(Pass `onSlideChange={onSlideChange}` to `CarouselLayout` instead of the old direct `reportCurrentSlide`.)

- [ ] **Step 5: Compute salah state on a 5s tick and render the overlay**

Add today's `DayData` + iqamah points derivation and a ticking salah evaluation:

```ts
  const todayDay: DayData | null = useMemo(() => {
    const days = state?.prayerTimes?.days ?? []
    const n = new Date()
    return (
      days.find((d: any) => {
        const dd = new Date(d.date)
        return dd.getFullYear() === n.getFullYear() && dd.getMonth() === n.getMonth() && dd.getDate() === n.getDate()
      }) ?? null
    )
  }, [state?.prayerTimes])

  const [salah, setSalah] = useState({ active: false, prayerName: null as string | null, iqamahLabel: null as string | null })
  useEffect(() => {
    if (!state) return
    const evaluate = () => {
      const now = new Date()
      const isFriday = now.getDay() === 5
      const jummah: string[] = state.prayerTimes?.jummahTimes?.map((j: any) => j.time).filter(Boolean) ?? []
      const order: { name: string; key: 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha' }[] = [
        { name: 'Fajr', key: 'fajr' }, { name: 'Dhuhr', key: 'zuhr' }, { name: 'Asr', key: 'asr' },
        { name: 'Maghrib', key: 'maghrib' }, { name: 'Isha', key: 'isha' },
      ]
      const iqamahs: IqamahPoint[] = order
        .map(({ name, key }) => {
          let label = todayDay?.[key]?.iqamah as string | undefined
          if (key === 'zuhr' && isFriday && jummah.length > 0) label = jummah[0]
          const minutes = parseTimeToMinutes(label)
          return label && minutes !== null ? { name, label, minutes } : null
        })
        .filter((x): x is IqamahPoint => x !== null)
      setSalah(
        computeSalahState({
          now,
          iqamahs,
          holdoverMinutes: state.prayerDisplay.salahHoldoverMinutes,
          manualUntil: state.prayerDisplay.salahManualUntil,
          manualClearedAt: state.prayerDisplay.salahManualClearedAt,
        }),
      )
    }
    evaluate()
    const t = setInterval(evaluate, 5_000)
    return () => clearInterval(t)
  }, [state, todayDay])
```

- [ ] **Step 6: Update renderSlide + add the overlay**

Replace the `prayer-times` case in `renderSlide`:

```ts
      case 'prayer-times':
        return (
          <PrayerDisplay
            variant={variant}
            content={content}
            day={todayDay}
            venueName={state.tenant.name}
            displayCity={state.prayerDisplay.displayCity}
            timezone={state.tenant.timezone}
          />
        )
```

Inside the `<main>` return, render the overlay above `CarouselLayout` (as a sibling, after the `</CarouselErrorBoundary>` wrapping the carousel):

```tsx
        {salah.active && (
          <SalahTakeover prayerName={salah.prayerName} iqamahLabel={salah.iqamahLabel} />
        )}
```

- [ ] **Step 7: Typecheck + build**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(kiosk)/kiosk/[deviceId]/page.tsx"
git commit -m "feat(kiosk): render PrayerDisplay variants + salah takeover, configurable dwell"
```

---

## Task 14: Manual salah endpoint (TDD-lite)

**Files:**
- Create: `src/app/api/kiosk/salah/route.ts`

Mirrors the auth pattern of `src/app/api/kiosk/push/route.ts` (`payload.auth` + tenant scoping + `overrideAccess: false`). `action: 'start'` sets `salahManualUntil = now + holdover`; `action: 'end'` sets `salahManualClearedAt = now`.

- [ ] **Step 1: Implement**

```ts
import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payloadClient'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const payload = await getPayloadClient()
  if (!payload) return NextResponse.json({ error: 'unavailable' }, { status: 503 })

  const auth = await payload.auth({ headers: await headers() })
  const user = auth.user as { id: string; role?: string; tenant?: any } | null
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const action = body?.action === 'end' ? 'end' : 'start'

  const userTenantId =
    typeof user.tenant === 'object' && user.tenant !== null && 'id' in user.tenant
      ? (user.tenant as { id: string | number }).id
      : user.tenant
  const tenantId = body?.tenant || userTenantId
  if (!tenantId) return NextResponse.json({ error: 'tenant-required' }, { status: 400 })
  if (user.role !== 'platformOwner' && String(tenantId) !== String(userTenantId)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const tenantDoc = await payload.findByID({
    collection: 'tenants',
    id: tenantId as string | number,
    user: auth.user,
    overrideAccess: false,
  })
  const holdover = Number((tenantDoc as any).prayerDisplay?.salahHoldoverMinutes ?? 15)
  const now = new Date()

  const data =
    action === 'start'
      ? {
          prayerDisplay: {
            ...((tenantDoc as any).prayerDisplay ?? {}),
            salahManualUntil: new Date(now.getTime() + holdover * 60_000).toISOString(),
            salahManualClearedAt: null,
          },
        }
      : {
          prayerDisplay: {
            ...((tenantDoc as any).prayerDisplay ?? {}),
            salahManualClearedAt: now.toISOString(),
          },
        }

  await payload.update({
    collection: 'tenants',
    id: tenantId as string | number,
    data,
    user: auth.user,
    overrideAccess: false,
  })

  return NextResponse.json({ ok: true, action })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual smoke test**

Start dev (`npm run dev`), log into admin, and with a valid session POST `{ "action": "start" }` to `/api/kiosk/salah` (via the admin button in Task 15, or curl with session cookie). Confirm the tenant's `prayerDisplay.salahManualUntil` is set ~15 min in the future. Confirm `{ "action": "end" }` sets `salahManualClearedAt`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/kiosk/salah/route.ts
git commit -m "feat(kiosk): manual salah trigger/clear endpoint"
```

---

## Task 15: Admin "Salah now" control

**Files:**
- Create: `src/admin/SalahControlBanner.tsx`
- Modify: `src/collections/Kiosks.ts`

- [ ] **Step 1: Implement the admin component**

```tsx
'use client'

import React, { useState } from 'react'

export default function SalahControlBanner() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const call = async (action: 'start' | 'end') => {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/kiosk/salah', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      setMsg(res.ok ? (action === 'start' ? 'Salah screen on.' : 'Returned to rotation.') : 'Action failed.')
    } catch {
      setMsg('Action failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
      <button type="button" disabled={busy} onClick={() => call('start')} className="btn btn--style-primary">
        Salah now
      </button>
      <button type="button" disabled={busy} onClick={() => call('end')} className="btn btn--style-secondary">
        End now
      </button>
      {msg && <span style={{ fontSize: 13, opacity: 0.8 }}>{msg}</span>}
    </div>
  )
}
```

- [ ] **Step 2: Mount it on the Kiosks list view**

In `src/collections/Kiosks.ts`, add to `admin.components.beforeListTable` (create the array if absent), mirroring how `CarouselSlides` mounts `KioskContentBanner`:

```ts
  admin: {
    // ...existing admin config...
    components: {
      beforeListTable: ['/src/admin/SalahControlBanner#default'],
    },
  },
```

(If `beforeListTable` already exists, append the path to the array.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (build compiles the admin bundle).

- [ ] **Step 4: Commit**

```bash
git add src/admin/SalahControlBanner.tsx src/collections/Kiosks.ts
git commit -m "feat(kiosk): admin Salah-now / End-now control"
```

---

## Task 16: Cleanup + full verification

**Files:**
- Delete: `src/app/(kiosk)/_components/PrayerTimesSlide.tsx`
- Delete: `src/app/(kiosk)/_components/IslamicContentDisplay.tsx`
- Delete: `src/app/(kiosk)/_lib/constants/islamicContent.ts`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "PrayerTimesSlide\|IslamicContentDisplay\|islamicContent" src --include=*.ts --include=*.tsx`
Expected: no matches outside the files being deleted. If `IslamicContentDisplay` is referenced by `CustomSlide.tsx` or elsewhere, leave that file in place and note it; otherwise proceed.

- [ ] **Step 2: Delete the retired files**

```bash
git rm "src/app/(kiosk)/_components/PrayerTimesSlide.tsx" "src/app/(kiosk)/_components/IslamicContentDisplay.tsx" "src/app/(kiosk)/_lib/constants/islamicContent.ts"
```

- [ ] **Step 3: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 4: Manual verification (cannot be asserted from dev env — call out explicitly)**

Pair a kiosk (or open `/kiosk/<deviceId>` with valid localStorage creds) and confirm on an actual 1920×1080 display:
- Each time the prayer slide surfaces, the look changes (no immediate repeat) and the verse/hadith changes.
- Fonts render (Amiri Quran Arabic not boxed); layout fills 16:9.
- Next-prayer column has the gold highlight; Friday shows the jummah time in the Dhuhr iqamah.
- At an iqamah time (or via "Salah now"), the takeover covers the screen and clears after the holdover / "End now".
- No console errors after several rotation cycles.

Report which of these were visually confirmed vs. not testable in the current environment.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(kiosk): remove legacy prayer slide + islamic content"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** visual variants (T10–11), random rotation (T5, T13), salah auto+manual (T6, T13, T14, T15), per-tenant content + seed fallback (T2, T3, T9), kind-decoupled hero with kind eyebrow (T11), Friday jummah (T7, T13), topbar city + Hijri (T1, T8, T11), configurable dwell (T1, T9, T13), version invalidation (T3 hook + T9 hash). Deferred items (NTP, offline caching, Aladhan Hijri) are intentionally not tasked.
- **Type consistency:** `ContentEntry` (T2) used in T5/T9/T11/T13; `PrayerVariant` (T5) in T11/T13; `IqamahPoint`/`computeSalahState` (T6) in T13; `DayData`/`parseTimeToMinutes`/`buildTimetable` (T7) in T11/T13; state `prayerDisplay` shape (T9 response) matches the `State` type (T13).
- **Known soft spots to watch:** exact `next/font` variable names in `src/lib/fonts.ts` (verify in T10 Step 2); the hero alias CSS rules (T11 note) require reading the variant-specific hero declarations from the ported CSS; `Kiosks.ts` may already define `admin.components` (append rather than overwrite in T15).
