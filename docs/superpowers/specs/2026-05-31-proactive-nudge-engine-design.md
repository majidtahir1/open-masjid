# Design: Proactive Nudge Engine (Ansari)

- **Date:** 2026-05-31 (revised 2026-06-11: review feedback folded in — donations rule cut, delivery acks, apply-time semantics, action taxonomy)
- **Status:** Implemented (OpenMasjid side) — Hermes integration pending
- **Plan:** [2026-06-11 plan](../plans/2026-06-11-proactive-nudge-engine.md)
- **Depends on:** [Agent Capability Surface v1](./2026-05-31-ai-agent-capability-surface-v1-design.md)
- **Related:** [Marketing Spotlight](./2026-05-31-ai-assistant-marketing-spotlight-design.md), [Multi-Tenant Productization](./2026-05-31-ansari-multi-tenant-productization-design.md)

## Context

Reactive **Ansari** waits to be asked. Proactive mode is the **same agent noticing first** — it messages the admin unprompted when something needs attention. It can only nudge about capabilities that already exist in v1 (it never acts beyond its scopes), so this builds directly on the capability-surface doc.

## Goal

A scheduled engine that watches a masjid's data + calendar, and when a rule fires, has Ansari send the admin a chat message containing the issue **and a one-tap suggested action**.

## Autonomy model: suggest + one-tap apply

Ansari never changes anything on its own. Each nudge presents the exact change and a confirm control:

> "No prayer times cover July. Extend the current schedule through August? **[Yes] [No] [Not now] [Stop these]**"

On **Yes**, Ansari executes the same scoped write API the reactive flow uses.

- **[No]** — dismiss this instance.
- **[Not now]** — valid but not today; rolls into the weekly digest.
- **[Stop these]** — mute this *rule type* entirely (an explicit signal, better than silent ignoring).

## System boundary: OpenMasjid is the brain, Hermes is the mouth & ears

The single most important architectural decision. OpenMasjid owns data, rules, decisions, and actions (it's the source of truth and already knows the masjid). Hermes owns language and channel (phrases things in Ansari's voice, sends to Telegram, listens for replies). We deliberately do **not** put rules/state in Hermes — that would create two systems that both think they know the truth and drift.

| Responsibility | Lives in | Why |
|---|---|---|
| The data (prayer times, events, forms…) | **OpenMasjid** | Source of truth |
| Nudge preferences (the setup screen) | **OpenMasjid** | A masjid setting, managed where admins manage everything |
| Rule definitions + evaluation | **OpenMasjid** | Domain logic with the domain; direct DB, no API round-trips |
| "Already told you" state / dedup | **OpenMasjid** | Bookkeeping about OpenMasjid conditions; survives Hermes restarts |
| Re-validate + execute a one-tap action | **OpenMasjid** | The "don't act on stale info" check runs against live truth |
| Deciding *when* to check (trigger) | **Hermes** | A simple heartbeat — "ping OpenMasjid hourly" |
| Phrasing the nudge in Ansari's voice | **Hermes** | Tone + LLM live with the agent |
| Sending to Telegram, catching button taps | **Hermes** | The channel it owns |

**Division of "research":** OpenMasjid decides *what* is worth surfacing (rules + dedup). Hermes decides *when to ask* (heartbeat) and *how to say it* (voice). Hermes never re-derives the decision.

### The contract (deliberately tiny)

OpenMasjid becomes a pure function: *given the time now, what should Ansari say?* — already filtered for preferences, quiet hours, and dedup. Hermes triggers it and delivers.

- `GET /api/ansari/nudges` → the nudges to deliver right now, each as **structured intent** (e.g. `{rule: "prayer.coverage_gap", period: "July", action: "extend_schedule"}`) — *not* pre-written prose; Hermes does the wording. Marks each returned finding **emitted** (not delivered) and keeps re-returning it on subsequent polls until acked — delivery is **at-least-once**, never silently lost.
- `POST /api/ansari/nudges/:id/ack` → Hermes confirms the Telegram send succeeded; the finding is now **delivered** and stops being returned. (If Hermes crashes, the LLM call fails, or Telegram is down, no ack arrives and the next poll re-returns the nudge.)
- `POST /api/ansari/nudges/:id/apply` → OpenMasjid **re-validates against live state**, then executes (or replies "already handled").
- `POST …/dismiss`, `…/snooze` (the [Not now] tap), and `…/mute` → updates state / preferences.

This makes Hermes a thin, swappable delivery layer, and because OpenMasjid is already per-tenant, multi-tenant later only needs a per-tenant Telegram binding + key.

## Behavior model: one ping per problem

The pipeline runs on every Hermes poll (~hourly); **dedup makes the frequency irrelevant** — a problem found this hour is *still there* next hour, so the rule is **fire once per problem, then stay silent while it's unchanged**, with a weekly digest as the safety net. (Hourly polling is needed anyway: `announcements.expiring` has a 24h window, and quiet hours require same-day re-checks.)

- **Fires once:** when a rule first detects a problem, Ansari speaks. On subsequent checks, if it's the *same* problem, Ansari is silent (no nagging).
- **Weekly safety net:** anything still unresolved resurfaces — gently, in a list — in the weekly digest. So the immediate tier can stay quiet without things falling through the cracks.
- **Genuinely-new problem speaks again:** if the situation changes (July gets covered but August opens up), that's a new problem and Ansari may speak.
- **Stale-apply protection:** tapping **[Yes]** hours later re-validates against live state before acting. Three outcomes:
  - Problem gone (you fixed it manually, or the record was resolved/expired) → "already handled," never a 404 — resolved NudgeState records are **kept and marked resolved** (retained ~90 days), not hard-deleted, so old Telegram buttons always land somewhere graceful.
  - Problem still there and the freshly computed action **matches** what the admin saw → execute.
  - Problem still there but the fresh action is **materially different** (data moved since the nudge) → do **not** execute; reply that things changed and emit a new nudge with the updated proposal. The admin only ever gets what they actually confirmed.

## Cadence: balanced (with guardrails)

- **Immediate** message for items that are *actionable and time-bound*.
- **Weekly digest** for soft/ambient items.
- **Quiet hours:** no immediate sends outside the configured local window.
- **Fire-once dedup:** as above.

## The rules engine

Not a configurable DSL (YAGNI). A **registry of discrete, named rules** run through a fixed **pipeline**. Typed rule objects are more testable and readable than config-driven magic for our ~9-rule set.

### Anatomy of one rule

```ts
type Rule = {
  id: string                 // 'prayer.coverage_gap' — stable; also the mute key
  category: NudgeCategory    // maps to a preferences toggle
  tier: 'immediate' | 'digest'
  evaluate(ctx): Finding[]   // the brain of the rule — [] when nothing to say; several forms/announcements can fire at once
}

type Finding = {
  dedupKey: string           // "is this the SAME problem?"
  intent: object             // structured, machine-readable: what's wrong + proposed action
  action: ActionDescriptor   // what [Yes] would do — a description, NOT yet executed
}

type ActionDescriptor =
  | { kind: 'direct'; /* idempotent write executed by /apply after re-validation */ }
  | { kind: 'conversation-starter' /* [Yes] hands off to the reactive flow with the intent as context */ }
```

Not every [Yes] is a one-tap write. **`direct`** actions (extend schedule, adjust iqamah, raise a form cap, extend an announcement) go through `/apply`. **`conversation-starter`** actions (start the Ramadan schedule flow, generate a flyer) are multi-step — `/apply` for those returns a handoff marker and Hermes continues in the normal reactive chat with the structured intent as opening context.

`ctx` provides tenant, **`now`** (injected, not read from the clock — makes rules unit-testable), timezone, and a data accessor.

### The pipeline (what `GET /api/ansari/nudges` runs)

1. **Load context** — tenant, timezone, preferences record.
2. **Select** — drop rules the admin disabled or muted.
3. **Evaluate** — run each rule's `evaluate(ctx)`; collect findings.
4. **Dedup** — look up each finding's `dedupKey` in NudgeState (any un-resolved state). Already delivered & unresolved → drop (silence). Emitted but never acked → re-emit. **Dismissed/applied & still firing → drop** (a [No] sticks for that problem instance; when the condition later clears, the sweep stamps `resolvedAt` without touching the status, so a genuine recurrence is treated fresh). New/changed → keep. A rule whose `evaluate` threw this cycle is exempt from the resolution sweep — transient failures must not resurrect delivered nudges. Duplicate states for one dedupKey (concurrent-poll race) self-heal: smallest id wins.
5. **Tier & timing gate** — immediate findings pass only inside the allowed window (i.e. *outside* quiet hours); a finding blocked by the gate is **held, not recorded** — it fires on the next in-window poll. Digest findings held until the weekly run (which also re-surfaces unresolved immediates).
6. **Snooze** — hold findings marked *Not now* until the next weekly digest.
7. **Emit & record** — return survivors as structured intents; write them to NudgeState as **emitted** (→ *delivered* only on Hermes ack).

### The dedup key is where the intelligence lives

Each rule defines what "the same problem" means — this is what makes Ansari smart instead of annoying:

| Rule | `dedupKey` keyed by |
|---|---|
| `prayer.coverage_gap` | the uncovered month |
| `prayer.iqamah_drift` | `(prayer, breachType)` |
| `events.low_rsvp` | event id |
| `forms.capacity` | form id + status (`near`/`full`) |
| `announcements.expiring` | announcement id + expiry date |
| `calendar.dst` | the transition date |
| `calendar.ramadan` | the Hijri year |

### Two symmetries

- **Re-validation reuses `evaluate()`.** `…/apply` re-runs the rule's check against live data — still firing with the *same* proposed action → execute; not firing → "already handled"; firing with a *different* action → don't execute, re-nudge with the new proposal. Discovery and apply share one source of truth.
- **Resolution frees the key.** When a condition goes false, its NudgeState is marked resolved (record retained ~90 days for stale-button handling, then GC'd), so a genuine recurrence later is treated as fresh.

### Where it lives in OpenMasjid

- `src/ansari/rules/` — the rule registry (one file per rule, each unit-testable: fixture data + `now` → `Finding` or `null`).
- A **NudgeState** collection — dedup/resolution bookkeeping.
- An **AnsariSettings** collection (per tenant) — toggles, quiet hours, digest day.
- The `/api/ansari/nudges|apply|dismiss|mute` endpoints orchestrate the pipeline, reusing existing scoped-access + tenant-scoping.

## Rule catalog

| # | Rule | Source | Condition | One-tap action | Kind | Scope | Tier |
|---|---|---|---|---|---|---|---|
| 1 | `prayer.coverage_gap` | data-state | schedule ends within **7 days**, nothing covers after | extend schedule | direct | `prayer-times:write` | immediate |
| 2 | `prayer.iqamah_drift` | data-state (lookahead) | absolute iqamah will breach gap floor/tolerance within **14 days** | adjust time, or convert to offset | direct | `prayer-times:write` | immediate |
| 3 | `calendar.dst` | calendar | DST change within **5 days** | review/shift Fajr & Isha | conversation-starter | `prayer-times:write` | immediate |
| 4 | `calendar.ramadan` | calendar (Hijri) | Ramadan begins within **14 days** | start Ramadan schedule flow | conversation-starter | `prayer-times:write` | immediate |
| 5 | `forms.capacity` | data-state | RSVP at **90%** / **100%** of capacity | raise cap or close | direct | `forms:write` | immediate |
| 6 | `announcements.expiring` | data-state | notice expires within **24h** | extend or remove | direct | `announcements:write` | immediate |
| 7 | `events.low_rsvp` | data-state | event within **3 days** and **< 25%** capacity (or < 10 uncapped) | post a reminder | direct | `announcements:write` | digest |
|   | ↳ *requires a new optional `signupForm` relationship on Events (→ Forms); events without a linked form are skipped — there is no other path from an event to its RSVP count.* |
| 8 | `events.missing_flyer` | data-state | event within **7 days**, no flyer | generate flyer | conversation-starter | `events:write` | digest |
| 9 | `digest.weekly` | scheduled | the weekly rollup | "want me to handle any of it?" | conversation-starter | reads only | digest |

> `donations.milestone` was **cut from v1** (2026-06-11): it needs `donations:read` (deferred to capability-surface v1.1 — no SUM endpoint) and there is no goal/target field on funds, so "80% of goal" has no denominator. Revisit alongside the v1.1 donations work.

### `prayer.iqamah_drift` detail

Watches **absolute-mode** iqamah rules only (offset mode self-corrects). Reuses OpenMasjid's already-computed `days[]` (no new prayer math): scans the next **14 days**, finds the earliest day a fixed iqamah breaches its relationship to the adhan:

- **Hard floor (critical):** iqamah within **5 min** of adhan, or before it → push forward.
- **Drift tolerance:** current gap strays more than **±10 min** from the *originally-intended* gap → propose restoring it.

The proposed fix preserves the **gap the admin originally intended** (when they set the time) — `adhan + originalGap` — so there's no universal "target gap" constant and Maghrib-short vs Fajr-long sorts itself out. It can also offer the *permanent* fix: convert the rule to offset mode so it never drifts again.

**Where `originalGap` comes from:** a `gapAtCreation` snapshot written by a save hook whenever an absolute iqamah time is set or changed — `iqamah − adhan` on the rule's effective date at save time. Existing absolute rules without a snapshot fall back to the gap on the **schedule's first day** (stable across runs, so the proposed action stays deterministic for the apply comparison; the rule's `evaluate` stays pure — no writes); they get a real snapshot on their next save.

## Thresholds & tunability

**v1 exposes** the per-rule on/off toggles, quiet hours, and the digest day/time. **Numeric thresholds are fixed sensible defaults** (defined on each rule, promotable to settings fields later). Rationale: a tunable number is a way to misconfigure and a support burden; a toggle is the control admins actually want, and good defaults "just work."

Defaults are the bold values in the rule catalog above. Key ones: coverage gap **7 days**; iqamah lookahead **14 days**, floor **5 min**, tolerance **±10 min**; forms capacity **90%/100%**; announcement expiry **24h**; DST lead **5 days**; Ramadan lead **14 days**; weekly digest **Sunday morning** (tenant-local, configurable).

**Mute/dismiss are per-tenant, not per-admin** — a deliberate v1 decision, fine while there's a single Telegram binding; revisit if a second admin chat is ever bound.

## Weekly digest contents

One scheduled message (default Sunday morning, tenant-local) aggregating:

- **Total members** and **new members this month**
- Upcoming events (and any still needing a flyer)
- Any unresolved immediate-tier items (the safety net)

(Donation/campaign progress joins the digest with the v1.1 donations work.)

**The LLM never touches the figures.** The digest intent carries exact numbers; Hermes renders them through a deterministic template and the LLM writes only the connective prose around them — a hard guard, not a SOUL.md suggestion, given the multi-turn drift already seen with the model.

## The setup screen

A per-tenant **AnsariSettings** Payload admin screen controlling:

- **Which nudges** are on/off (per-rule checklist, by category)
- **Quiet hours** (local window)
- **Weekly digest** day/time
- **Channel binding** — "connect Telegram" (the chat-id link is held Hermes-side; OpenMasjid stores *that* it's connected + the on/off)

`GET /api/ansari/nudges` reads this record, which is why it can pre-filter before Hermes ever sees anything.

## Hermes side (the mouth & ears)

1. **`soul.md`** — Ansari's persona/voice (lives in Hermes, outside this repo): identity ("Ansari — the helper"), warm/respectful/concise *khādim* tone with tasteful adab; hard rules (never act without confirmation, never invent data, always read from OpenMasjid, one ask at a time, respect *Not now*/*Stop these*); boundaries (no fatwa — defer fiqh to scholars; conservative with money & PII); Telegram formatting.
2. **Crons (heartbeat)** — scheduled poll (~hourly) → `GET /api/ansari/nudges` → phrase each structured intent via the LLM + `soul.md` → send to Telegram with `[Yes] [No] [Not now] [Stop these]`. The weekly digest is just an intent emitted at the right time; Hermes renders the rollup into a nicer narrative.
3. **Telegram I/O** (exists) — add routing: button taps → `POST …/apply|dismiss|mute`; free-text → the existing reactive flow.
4. **OpenMasjid API client** — the scoped-key HTTP client (key already in `.env`) extended to hit `/api/ansari/*` plus existing read/write APIs. Holds the channel binding (which Telegram chat ↔ which masjid) — the one thing that becomes per-tenant later.

## Out of scope

- **Multi-tenant** scheduling/fan-out — engine runs for the single configured tenant for now; per-tenant productization is designed separately in [Multi-Tenant Productization](./2026-05-31-ansari-multi-tenant-productization-design.md) (profile-per-masjid).
- **Auto-act** (autonomy level 3) — explicitly rejected; everything is suggest + confirm.
- **Real-time event-driven nudges** (webhooks the instant a form hits capacity) — the daily scan approximates this; revisit if latency matters.
- **Admin-tunable numeric thresholds** — defaults only in v1.

## Open questions

- Quiet-hours default window (e.g. 8am–9pm tenant-local?) — confirm at implementation.
- NudgeState location is settled as a Payload collection (survives VM restarts, ready for multi-tenant).
- Whether `events.low_rsvp` "low" should consider historical turnout rather than a flat 25% — revisit post-v1.
