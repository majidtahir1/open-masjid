# Design: AI Assistant — Marketing Spotlight

- **Date:** 2026-05-31
- **Status:** Approved (brainstorm) → ready for implementation plan
- **Scope:** Marketing page only. Buildable now. No backend changes.
- **Related:** [Agent Capability Surface v1](./2026-05-31-ai-agent-capability-surface-v1-design.md), [Proactive Nudge Engine](./2026-05-31-proactive-nudge-engine-design.md)

## Context

We now have a working AI assistant: a Hermes agent on a separate VM, connected to Telegram, calling OpenMasjid's scoped REST API to read and update prayer times (diff-then-confirm). It works today for a single masjid (the operator's API key in the agent's `.env`).

No competing masjid CMS lets an admin run the masjid by chat. This is our most differentiating capability, so the marketing page should feature it prominently — not bury it as one tile among nine.

The product is **pre-launch with no real clients**, so the spotlight may depict the full near-term vision (announcements, forms, Q&A) even though only prayer-times is wired end-to-end today. We are building the rest very soon (see docs #2 and #3).

## Goal

Add a dedicated **spotlight section** plus an **anchor tile** to the marketing page that markets the AI assistant under the framing **"an AI assistant for your masjid"** (channel-agnostic; Telegram is the example, not the headline).

## Name

The assistant is named **Ansari** (product-facing: **OpenMasjid Ansari**). From *al-Anṣār* — "the helpers" of Madinah honored in the Qur'an for hosting and supporting; *Ansari* = "the helper." Reads naturally as a persona you'd text ("I'll have Ansari update Fajr"). Use **Ansari** in copy where a name reads warmer than "the assistant."

## Non-goals

- No in-app/browser chat UI (the assistant lives in chat apps via Hermes).
- No backend, API, or auth changes.
- No claims tying the pitch to one channel ("Telegram-only").

## Current marketing page structure

`src/app/(marketing)/marketing/page.tsx`:

1. Hero (~62–104)
2. Problem — "The status quo" (~106–148)
3. Benefits — "Why OpenMasjid" (~150–190)
4. How it works (~192–210)
5. Feature grid — `FEATURES` array (~40–49), rendered ~212–237
6. Proof/testimonial (~239–249)
7. Final CTA (~251–275)

Styling: custom CSS in `src/app/(marketing)/marketing.css` using `--om-*` design tokens (not Tailwind). Icons from `src/app/(marketing)/_components/Icons.tsx`.

## Design

### Placement

- **New spotlight section** inserted between **Benefits ("Why OpenMasjid")** and **How it works** (~line 190/192). Rationale: the visitor has just learned *why* OpenMasjid; the assistant is the "and here's the thing nobody else has" moment before the how-to.
- **Anchor tile** added to the `FEATURES` array so grid-scanners still hit it; the tile's `to` links to the spotlight anchor (`/marketing#assistant`) rather than a feature subpage.

### Copy

**Eyebrow:** `New · Meet Ansari, your masjid's AI assistant`

**Headline:** `Text your masjid. It runs itself.`

**Subhead:** Message **Ansari** in plain language. It understands, shows you the change, and does it — across your prayer times, announcements, events, and every screen in the building. No dashboard, no training.

**Chat mockup (static, illustrative):** three exchanges shown as chat bubbles:
- "Change Fajr iqamah to 5:45" → ✓ *Updated — new Fajr iqamah 5:45 AM, live on 3 displays.*
- "We're closed tomorrow for snow" → ✓ *Announcement posted and pushed to all screens.*
- "How many signed up for the Eid dinner?" → *184 RSVPs, 16 spots left.*

**Proactive line:** *Ansari looks out for you, too* — "Ramadan's in two weeks — want me to set up the schedule?" "No prayer times cover June — extend them?"

**CTA:** `Join the beta →` (links to existing signup/contact CTA target used elsewhere on the page).

### Visual treatment

A **static chat-bubble mockup** rendered in a phone frame, CSS-only — no live chat, no JS, no network. Reuse the hero's existing "browser frame" device pattern as a sibling component if one exists; otherwise a simple bordered card with alternating left (user) / right (assistant) bubbles. Assistant confirmations show a check glyph (reuse `Check` from `Icons.tsx`).

Pick an icon for the anchor tile and section eyebrow: reuse `Sparkles` or `MoonStar` from `Icons.tsx` (no new icon needed).

### Structure / how it's built

- Add the spotlight as inline JSX in `page.tsx` following the existing section conventions (`.om-section`, `.om-container`/`.om-narrow`, `.om-h2`, eyebrow pattern), **or** extract a small `_components/AssistantSpotlight.tsx` if the JSX gets long. Prefer extraction for readability since the chat mockup adds markup.
- Add one entry to the `FEATURES` array (`Icon`, `title: 'AI assistant'`, `body`, `to: '#assistant'`).
- Add new CSS classes to `marketing.css` namespaced `.om-assistant-*` (section, phone frame, bubble-user, bubble-assistant, proactive callout). Follow existing token usage; no new design tokens.

### Responsive

- Desktop: two-column (copy left, phone mockup right), matching the hero's split.
- Mobile: stack — copy first, mockup below. Bubbles remain legible at small widths.

## Testing

- Manual visual check at desktop + mobile breakpoints (the gstack `/browse` or `/design-review` skill).
- If the page has render/smoke tests under `tests/`, add an assertion that the spotlight heading and anchor (`id="assistant"`) render and the new `FEATURES` tile links to `#assistant`.
- Lighthouse/visual: section must not regress page CLS (static mockup, fixed dimensions).

## Out of scope (captured for later docs)

- Wiring announcements/forms/events/Q&A end-to-end → doc #2.
- The proactive nudges depicted → doc #3.
- Multi-tenant productization of the Hermes agent → future, not yet designed.
