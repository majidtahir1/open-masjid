# Design: Proactive Nudge Engine

- **Date:** 2026-05-31
- **Status:** Approved (brainstorm) → future implementation (after capability surface v1)
- **Scope:** Scheduled, proactive nudges from the AI assistant.
- **Depends on:** [Agent Capability Surface v1](./2026-05-31-ai-agent-capability-surface-v1-design.md)
- **Related:** [Marketing Spotlight](./2026-05-31-ai-assistant-marketing-spotlight-design.md)

## Context

Reactive **Ansari** waits to be asked. Proactive mode is the **same agent noticing first** — it messages the admin unprompted when something needs attention. It can only nudge about capabilities that already exist in v1 (it never acts beyond its scopes), so this builds directly on doc #2.

## Goal

A scheduled engine that watches a masjid's data + calendar, and when a rule fires, sends the admin a chat message containing the issue **and a one-tap suggested action**.

## Autonomy model: suggest + one-tap apply

The agent never changes anything on its own. Each nudge presents the exact change and a confirm control:

> "No prayer times cover July. Extend the current schedule through August? **[Yes] [No]**"

On **Yes**, the agent executes the same scoped write API the reactive flow uses (diff-then-confirm already satisfied by the nudge). This mirrors the trust model users already accept.

## Cadence: balanced (with guardrails)

- **Immediate** message for items that are *actionable and time-bound* (coverage gap, RSVP at capacity, announcement expiring today, event in N days with low signups).
- **Weekly digest** for soft/ambient items (new-member count, donation progress, "1 event still needs a flyer").
- **Quiet hours:** no immediate sends outside configured local hours (defaults TBD, e.g. 8am–9pm tenant-local).
- **Fire-once dedup:** a rule that has fired stays silent until its underlying state changes — no daily re-nagging.

## Nudge catalog

| # | Trigger source | Condition | Suggested one-tap action | Scope used |
|---|---|---|---|---|
| 1 | data-state scan | no prayer schedule covers next month | extend current schedule | `prayer-times:write` |
| 2 | calendar anchor | DST change this week | review/shift Fajr & Isha | `prayer-times:write` |
| 3 | calendar anchor (Hijri) | Ramadan begins in ~2 weeks | start Ramadan schedule flow | `prayer-times:write` |
| 4 | data-state scan | event in 3 days with low RSVPs | post a reminder announcement | `announcements:write` |
| 5 | data-state scan | RSVP near/at capacity | raise cap or close form | `forms:write` |
| 6 | data-state scan | upcoming event has no flyer | generate branded flyer | `events:write` |
| 7 | data-state scan | announcement expires today | extend or remove | `announcements:write` |
| 8 | data-state scan | donation campaign ≥X% with deadline near | post an update to screens | `announcements:write` |
| 9 | weekly digest | rollup: members, events, flyers, donations | "want me to handle any of it?" | reads only |

## Trigger model

Three feeders into one nudge engine:

1. **Calendar anchors** — DST, Ramadan/Eid via Hijri date, weekly Jummah. Predictable, high-value.
2. **Daily data-state scan** — a job hits the read API and evaluates the rule set (coverage gaps, expiries, capacity/goal thresholds).
3. **Weekly digest** — one scheduled summary message.

## Architecture

```
cron (Hermes VM, daily + weekly)
  └─ Nudge engine
       ├─ fetch: scoped READ API (prayer-times/events/forms/announcements/members/donations)
       ├─ evaluate: rule set (calendar anchors + data-state thresholds)
       ├─ dedup: skip rules already fired for current state (NudgeState store)
       ├─ quiet-hours gate
       └─ for each fired rule:
            agent composes message + one-tap control → Telegram
                 └─ on "Yes" → scoped WRITE API (same as reactive flow)
```

### State / dedup

- A small **NudgeState** store keyed by `(tenant, ruleId, stateHash)`. `stateHash` captures the condition's salient state (e.g. the uncovered month, the form's capacity status). A rule re-fires only when `stateHash` changes.
- Records expire/garbage-collect after the condition resolves.
- Where this store lives: TBD — a lightweight collection in Payload, or local state on the Hermes VM. Leaning Payload-side so it survives VM restarts and is ready for multi-tenant.

### One-tap mechanism

- Telegram inline buttons (`[Yes] [No]`) on the nudge message; the callback maps to the prepared write. The prepared change is bound to the callback so "Yes" applies exactly what was previewed (no re-interpretation).

## Out of scope

- **Multi-tenant** scheduling/fan-out — engine runs for the single configured tenant for now; per-tenant productization is a separate, not-yet-designed effort.
- **Auto-act** (autonomy level 3) — explicitly rejected for v1; everything is suggest + confirm.
- Real-time event-driven nudges (webhooks the instant a form hits capacity) — the daily scan approximates this; revisit if latency matters.

## Open questions

- Quiet-hours defaults and whether they're admin-configurable in v1.
- NudgeState location (Payload collection vs. VM-local) — decide at implementation.
- Digest day/time default.
