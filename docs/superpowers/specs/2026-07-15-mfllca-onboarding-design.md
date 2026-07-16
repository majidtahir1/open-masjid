# MFLLCA Tenant Onboarding — Design

**Date:** 2026-07-15
**Status:** Approved by Majid (conversation, 2026-07-15)

## Goal

Onboard MFLLCA (McKinney) as a new open-masjid tenant. Primary goal: drive donations
to their community-center property purchase via their own Stripe account. Secondary
goal: collect "learn more" signups. Site shape: one main page with the property
picture and a donate CTA, plus a project subpage with progress/timeline updates.

MFLLCA context (from their flyer / brief):
- Fundraising to purchase a property in McKinney (near The Clubs of Stonebridge Ranch):
  4,431 SF building, 2.02-acre lot, $1.2M purchase price.
- Campaign tagline: "Building Our Future. Together."
- Planned programs: youth mentoring/counseling, language classes (Arabic, Spanish,
  French, German — plus English instruction), educational seminars, pre-marital and
  family counseling, career/financial education.
- Website domain on flyer: www.mfllca.com. Zelle alternative: 469-235-7674.
- No building yet — **no prayer times should appear on the site for now.**

## Scope summary

Items 1–5 are pure config/content via the existing admin + endpoints. Item 6 is the
only code change.

### 1. Tenant creation (config)

Use the existing platform-owner endpoint (`src/endpoints/createTenant.ts`):
- name: MFLLCA's full org name (confirm exact legal/display name with them; flyer
  shows both "MFLLCA" and "MFIC Community Center Project" — use what they confirm)
- slug: `mfllca` → `mfllca.openmasjid.app`
- siteType: `masjid`
- adminEmail: their contact's email (they receive a password-setup link)

Custom domains `mfllca.com` / `www.mfllca.com` added to the tenant once they point
DNS at the server. Branding colors: green/gold/navy from the flyer.

### 2. Donations — Stripe Connect (config)

- Their admin completes the existing Stripe Connect OAuth flow
  (`/api/stripe/connect/authorize` → callback sets `donationConfig.stripeAccountId`).
- Set `donationConfig.mode = 'connect'`.
- Create one `DonationFund`: **Community Center Project**, preset amounts
  $50 / $100 / $500 / $1,000 with custom amount allowed.
- Donations checkout on-site via `/api/donations/checkout`; records visible in their
  admin with CSV export.
- Zelle (469-235-7674) mentioned as an alternative in page content only — no
  integration.

### 3. Homepage (content)

Standard tenant homepage, campaign-focused content:
- Hero slide (`HeroSlides`): property rendering image; headline "Building Our
  Future. Together."; subtext adapted from the flyer ("MFLLCA is working to purchase
  this property to establish a welcoming space dedicated to community programs,
  education, wellness, family support, and meaningful gatherings."); primary CTA →
  Donate; secondary CTA → the signup form.
- `Services` seeded from planned programs: Youth Mentoring & Counseling; Language
  Classes (Arabic, Spanish, French, German); Educational Seminars; Pre-Marital &
  Family Counseling.
- **No `PrayerSchedules` doc seeded** — the hero's live iqamah block already renders
  nothing when `getActiveSchedule` returns null.
- No events seeded initially; the events section will simply be empty/minimal.

### 4. Project subpage (content)

One `Pages` doc: title "Community Center Project", slug `project`,
`showInNav: true`, published. Content:
- Property highlights: 4,431 SF, 2.02 acres, $1.2M purchase price, commercially
  zoned for office/childcare/learning center/church use.
- What donations fund (secure purchase, preserve/improve facility, youth/family/
  senior spaces, expand programs, long-term home).
- **Timeline / progress updates** section — a running list they edit as milestones
  happen (this is the page they'll keep updating).
- Donate CTA + Zelle alternative.

### 5. "Learn more" signup form (content)

One `Forms` doc: fields name, email, phone (optional), and an optional "Which
programs interest you?" free-text or multi-select. Linked from the hero secondary
CTA and the project page. Submissions viewable in their admin.

### 6. Code change: hide Prayer Times nav without an active schedule

The header (`src/components/Header.tsx:29`) and footer
(`src/components/Footer.tsx:77`) hard-code a `/prayer-times` link, which for MFLLCA
would lead to an empty page.

Change: conditionally omit the Prayer Times link when the tenant has **no active
prayer schedule** (same `getActiveSchedule` signal the hero uses). The `/events`
link stays (they'll host seminars soon). The `/prayer-times` route itself can remain
reachable by URL; only the nav visibility changes. This benefits any future
pre-building tenant.

Testing: unit-level test of the nav-link filtering given schedule/no-schedule;
verify visually on a seeded tenant with and without a schedule.

## Error handling / edge cases

- Stripe Connect not completed yet at launch → keep `donationConfig.mode` unset to
  external with no URL only briefly; do not publish the site's donate CTA until
  Connect is done (donations are the whole point).
- DNS for mfllca.com may lag — `mfllca.openmasjid.app` serves as the public site
  until custom domains resolve.

## Out of scope

- Per-tenant homepage section toggles (stripped-down fundraiser layout).
- Fundraising thermometer / progress-toward-$1.2M widget.
- Prayer times, membership, kiosk, school features for this tenant.
