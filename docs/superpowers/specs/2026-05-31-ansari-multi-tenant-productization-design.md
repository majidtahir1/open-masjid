# Design: Ansari — Multi-Tenant Productization

- **Date:** 2026-05-31
- **Status:** Approved (brainstorm) → future implementation (after capability surface v1 + proactive engine)
- **Depends on:** [Agent Capability Surface v1](./2026-05-31-ai-agent-capability-surface-v1-design.md), [Proactive Nudge Engine](./2026-05-31-proactive-nudge-engine-design.md)
- **Related:** [Marketing Spotlight](./2026-05-31-ai-assistant-marketing-spotlight-design.md)

## Context

Today Ansari runs as a **single** Hermes agent (Nous Research's [hermes-agent](https://github.com/NousResearch/hermes-agent)) on a VM, with the operator's OpenMasjid API key in its `.env` and one Telegram bot — i.e. it serves exactly one masjid. OpenMasjid itself is already multi-tenant (tenant-scoped data, per-user scoped API keys, billing lock). Productization means **any masjid's admin can use Ansari, scoped to only their masjid, without an operator hand-editing a config file.**

This design was validated against the Hermes documentation (Profiles, Security, Architecture, Multi-Gateway pages) and GitHub issue [#34352](https://github.com/NousResearch/hermes-agent/issues/34352) ("Solving the Multi-Tenant Hermes Problem"). Those sources materially shaped the decision below.

## The decision: Option A — profile-per-masjid

Hermes is **single-principal by design**: one agent = one tenant. Its native multi-tenancy primitive is the **profile** — a separate home directory with its own `config.yaml`, `.env`, `SOUL.md`, sessions, memory, **cron jobs**, **skills**, and **its own gateway process + bot token**. Multi-tenant = run **N profiles, one per masjid**.

We choose **profile-per-masjid** for the pilot because:

- It uses **native Hermes primitives** — no fork, no custom gateway.
- Isolation is **physical, not a permission check**: separate key, bot, process, and memory per masjid. This also **dissolves the "credential vault" risk** of pooling keys — each masjid's scoped key lives only in its own profile `.env` / process.
- It maps cleanly onto the brain/mouth design we already specced.

Trade-off accepted: it's **one install but N running gateway processes** (`hermes update` updates shared code once; each profile runs its own service). Per-process cost is ~200 MB (per issue #34352). Fine for a pilot; a scaling ceiling addressed under "Scale path" below.

## Architecture: shared brain, isolated mouths

- **OpenMasjid = the shared brain for all masajid.** Already multi-tenant: every masjid's data, rules, dedup state, preferences, and the `/api/ansari/*` endpoints live in the one deployment, scoped by tenant. *One brain, tenant-aware.*
- **Each Hermes profile = the mouth & ears for one masjid.** Its cron heartbeat calls `GET /api/ansari/nudges` with *that masjid's* scoped key; OpenMasjid returns *that masjid's* nudges; the profile's Ansari phrases them in its `SOUL.md` voice and delivers to *that masjid's* Telegram. *Many mouths, each isolated.*

Nothing in the capability-surface or proactive specs changes — they were already tenant-scoped on the OpenMasjid side.

## The portable contract (forward-compatible with single-daemon)

Make the `/api/ansari/*` endpoints take an **explicit tenant/context id**, asserted by a trusted Ansari caller, with the **binding authoritative in OpenMasjid**. This keeps us portable:

- **Option A (now):** the context id is the profile's single masjid — effectively constant per gateway.
- **Option C (later, single daemon):** the context id varies per inbound message.

Same OpenMasjid contract either way, so moving from profile-per-masjid to a single multi-tenant daemon is a **swap, not a rewrite**. (The `context_id` concept in issue #34352 is exactly this carrier.)

## Per-masjid provisioning

A provisioning script (triggered by OpenMasjid when a masjid enables Ansari) performs, per masjid:

1. `hermes profile create masjid-<slug>`
2. Mint a **scoped OpenMasjid API key** (per-entity scopes from the capability-surface doc) → write to the profile `.env` as `OPENMASJID_API_KEY`.
3. Assign a **Telegram bot token** → write to `.env` (see "One bot per masjid" friction below).
4. Drop a `SOUL.md` templated with the masjid name (Ansari's voice).
5. **Enable the Ansari skill** in the profile.
6. **Install the heartbeat cron** (`GET /api/ansari/nudges`).
7. `masjid-<slug> gateway start` (or `gateway install` as a managed service).

Skill *updates* are then global (`hermes update` syncs to all profiles); only key, token, SOUL.md, cron, and pairing are per-masjid.

## Onboarding / identity binding

- Admin enables Ansari in the OpenMasjid admin and picks a plan.
- After provisioning, the admin messages their masjid's bot, receives an 8-char **DM pairing code**, which OpenMasjid auto-approves (driving `hermes pairing approve telegram <code>`).
- Additional admins at the same masjid pair their own Telegram to the same profile (added to that profile's allowlist).
- The authoritative `telegramUserId → user` binding lives in OpenMasjid (consistent with the brain/mouth rule). Hermes's pairing list is the per-profile cache.

## Crons across profiles

**Per-profile and isolated** — a cron in one profile never runs for another. So the proactive heartbeat is installed **per masjid** at provisioning time. Two options:

- **(a) Per-profile cron (native, pilot default):** each profile schedules its own `GET /api/ansari/nudges`. Simple, fully native; N crons to provision/monitor.
- **(b) OpenMasjid-driven push (revisit at scale):** OpenMasjid runs one scheduler and pushes each nudge into the right profile's Telegram via an inbound channel. Centralizes scheduling; needs a push path into each gateway.

## Skills across profiles

- **Skill code is installed once and shared.** `hermes update` syncs new bundled skills to **all** profiles automatically; user-modified skills are never overwritten.
- **Enablement/customization is per-profile.**

Therefore build the Ansari logic as a **bundled skill**: maintain it **once**, propagate to every masjid via `hermes update`. Provisioning only needs to *enable* it per profile.

## SOUL.md

Per-profile (lives in each profile's home dir). Templated with the masjid name so Ansari greets and refers to the right masjid. The persona itself (warm *khādim* tone, hard rules, no-fatwa boundary) is shared content; only the masjid name varies per profile.

## Honcho (optional memory enhancement — separate from isolation)

Honcho is Hermes's persistent user-modeling/memory layer, **per-profile by design** (each profile builds its own observations and identity). Adding it gives each masjid's Ansari real memory — an admin's preferences, the masjid's patterns — improving quality.

**Keep this strictly separate from tenant isolation.** Option A already provides isolation via separate profiles; Honcho is *not* doing isolation here, it's doing memory quality/persistence. Conflating the two is the exact trap issue #34352 warns about. Honcho is an additive, deferrable enhancement; it conflicts with nothing in this design.

## Security considerations

- **Isolation is structural:** separate `.env` (chmod 600), bot token, process, and memory per masjid. No shared credential vault.
- **OpenMasjid enforces tenant scoping server-side** regardless of Hermes behavior — defense in depth. Even a mis-routed call is rejected cross-tenant.
- **Optional sandboxing:** run profiles on Docker/Modal/Daytona backends to isolate agent commands from the host.
- **Scale-path forks must be vetted** before they touch masjid credentials (see below) — adopting a third-party fork cuts against the product's "smaller attack surface" pillar.

## Operational scaling

- **Pilot (1–30 masajid):** trivial — a handful of gateway processes on one VM, managed via a `hermes-gateways` shell loop.
- **Growing (dozens–low hundreds):** requires the provisioning script; idle profiles waste a process each unless run on **Modal/Daytona** serverless backends that hibernate idle agents (near-zero idle cost).
- **Large (hundreds+):** profile-per-masjid strains (N processes, N bot tokens, monitoring). Trigger to evaluate the scale path.

**Two real frictions:**

1. **One Telegram bot per masjid.** Telegram has no clean API to *create* bots (done via @BotFather). Options: maintain a **pool** of pre-created bots, automate BotFather, or have the masjid bring their own bot token. This is the sharpest edge.
2. **Provisioning automation.** Until the script exists, onboarding is manual per masjid. Fine for a pilot, a blocker for self-serve.

## Scale path (Option C): consume, don't build

When per-process cost bites, single-daemon multi-tenancy is increasingly a thing to *adopt* rather than build from scratch. Per issue #34352:

- **NimbleCoAI fork + "Hermes Swarm Map":** adds `context_id` memory scoping + a proposed `memory:scope` hook for single-daemon multi-tenancy. Running in production (8 agents).
- **Honcho-based memory isolation:** disable global memory, use Honcho's native multi-user scoping (referenced PR #36160 isolates Honcho per profile).
- **Upstream:** track issues #9514, #17068, #35947, #36160.

**Caveats (why we don't bet on these yet):**
- Maintainers triaged the multi-tenant issue **P3 ("Low, nice to have"), no PRs merged** — it is **not** landing in official Hermes soon. Today the single-daemon path means running a **third-party fork**, with rebase/security/longevity risk.
- These solve **memory/session isolation**, **not per-tenant downstream credentials** — the per-masjid OpenMasjid key question stays on us regardless (our context-id-portable contract is how we answer it).

Because our `/api/ansari/*` contract is context-id-explicit, migrating A → C is a swap of the Hermes layer, not a rewrite of OpenMasjid.

## Out of scope

- Building a custom single-daemon multi-tenant gateway now (Option C is deferred and likely consumed, not built).
- Adopting the NimbleCoAI fork or Swarm Map for the pilot (vet first; not needed at pilot scale).
- White-label per-masjid bot branding beyond the bot identity itself.

## Open questions

- **Telegram bot supply:** pool vs BotFather automation vs bring-your-own — decide before self-serve onboarding.
- **Heartbeat:** per-profile cron (a) vs OpenMasjid-driven push (b) — start with (a), reassess at scale.
- **Serverless backend:** evaluate Modal vs Daytona for idle hibernation economics before the "growing" band.
- **Honcho:** include in the pilot for memory quality, or defer until after the core flows are proven?
