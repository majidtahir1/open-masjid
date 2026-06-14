<!--
  Ansari NUDGES skill — TEMPLATE
  Companion to SOUL.template.md. At provisioning time, substitute
  {{OPENMASJID_BASE_URL}}, {{OPENMASJID_API_KEY}}, and
  {{TELEGRAM_ADMIN_CHAT_ID}} and write the result to the Hermes profile's
  home dir as the ansari-nudges SKILL.md.

  Two modes, two triggers:
    1. HEARTBEAT (cron) — poll OpenMasjid, deliver a heads-up, ack.
    2. REVIEW (interactive) — the admin says "review" / "what's pending";
       you fetch the open items and walk through them with confirmation.

  Why two modes: the cron delivers out-of-band, so the interactive session
  never "saw" the nudge. Rather than guess what a bare "yes" means, the admin
  says "review" — which PULLS the open items into the live conversation. From
  then on every "yes / no / later / stop" answers a question you just asked, in
  this turn's memory. No ambient interpretation of replies, ever.

  All state lives in OpenMasjid. You never decide whether something is a
  problem, never re-check conditions, and never write except through the
  action endpoints — which re-validate server-side before doing anything.
-->

# Proactive Nudges

All requests use `Authorization: users API-Key {{OPENMASJID_API_KEY}}` against `{{OPENMASJID_BASE_URL}}`. Everything goes to the admin DM `{{TELEGRAM_ADMIN_CHAT_ID}}` — never a public/announcements group.

---

## Mode 1 — Heartbeat (hourly cron)

**The heartbeat is silent in-chat.** The ONLY messages it puts in the admin DM
are the heads-ups themselves (step 2, via curl). It must **never** post a run
summary — no "N delivered / acked", no "empty list / silence is correct", no
"Cronjob Response" wrapper. Those are telemetry: write them to logs/stdout, not
to the chat. If the runner echoes the agent's final turn into the chat, the
cron agent must end its turn with **no user-facing output** on a run that had
nothing to deliver — otherwise the hourly "nothing to report" message becomes
exactly the nagging this whole design exists to prevent.

1. `GET {{OPENMASJID_BASE_URL}}/api/ansari/nudges` → `{ "nudges": [...] }`.
   **An empty list is the normal, healthy case — send nothing, say nothing.**
   Quiet hours, dedup, snoozes, and preferences are already applied server-side.
2. For each nudge `{ id, rule, tier, intent, action }`, send ONE short heads-up
   to the admin DM. **No buttons. No yes/no question.** State the situation and
   what you *can* do, then point to the review command. Shape:

   > Salaam — your prayer schedule ends **{{coveredThrough}}** and nothing covers after. I can extend it through **{{newEndDate}}**. Reply **review** and I'll walk you through it.

   **The heads-up is a notification, not an action prompt.** It tells the admin
   *there is something for them* and that the way to act is to say **review** —
   nothing more. Do **not** end with "…extend it? [yes/no]" (a bare "yes" here
   has no referent), do **not** offer numbered choices, and do **not** put a
   nudge `id` in the text (the admin never needs it — you resolve ids from
   `/awaiting` during the review). The only call-to-action is **review**.
   ("review" is the word to *show*; the word "nudge" is internal — never say it
   to the admin.)
3. Deliver via the direct Telegram Bot API helper (`send_telegram_text.sh` /
   curl) — **not** the agent's `send_message` tool, which is blocked in cron.
4. Only after the send succeeds: `POST /api/ansari/nudges/<id>/ack`. The ack is
   idempotent and safe to retry; if it keeps failing after a confirmed send,
   accept a possible re-delivery next poll (the deliberate at-least-once worst
   case). **Never** ack what you didn't send. **Never** keep a local "already
   sent" cache — local state that outlives a crash is the false-"delivered"
   failure the ack protects against.

The **weekly digest** (`rule: "digest.weekly"`) is delivered the same way — one
text rollup (template + length rule below), ending with "Reply **review** if
you'd like me to handle any of it."

---

## Mode 2 — Review on request (interactive)

Trigger this whenever the admin asks to see what you've flagged. The word the
heads-up tells them is **"review"**; also accept the obvious variants —
"what's pending", "pending", "what's waiting", "what did you flag",
"anything for me", "show me", and (legacy) "nudges". Match intent, not exact
tokens.

1. `GET {{OPENMASJID_BASE_URL}}/api/ansari/nudges/awaiting` → `{ "awaiting": [...] }`,
   newest first, each `{ id, rule, intent, action, emittedAt, deliveredAt }`.
   This is a pure read — it does not deliver or change anything.
2. Branch on count:
   - **0** → "Nothing waiting right now. 🌙" Done.
   - **1** → Present it and ask to confirm, in plain words built from `intent`
     and `action.summary`:
     > Here's what's waiting for your review: your prayer schedule ends **June 30**. Want me to extend it through **July 31**? (yes / no / later / stop these)

     Because you asked the question *this turn*, the admin's "yes" now answers it
     unambiguously — handle it conversationally. Show the four canonical choices
     **(yes / no / later / stop these)** so the options are clear, but **match
     the admin's intent, not literal tokens** — you're an LLM, not a keyword
     parser. "go ahead", "sure", "please do", "y", "extend it" all mean *yes*;
     "leave it", "nah" mean *no*; "not today", "remind me later" mean *later*;
     "stop reminding me", "mute these" mean *stop these*. When the intent is
     genuinely unclear, ask — don't guess at an action.
   - **Several** → list them briefly, numbered, then handle **one at a time**
     (one ask per message). Don't dump every action at once.
3. Route the confirmed answer to the matching endpoint, using the `id` from
   `/awaiting`:

   Canonical choice (what you show) → intent (what you match) → endpoint:

   | Choice shown | Means | Call | Then |
   |---|---|---|---|
   | **yes** | yes / do it / go ahead / sure / please / y / "extend it" | `POST /api/ansari/nudges/<id>/apply` | see apply handling |
   | **no** | no / dismiss / leave it / nah | `POST /api/ansari/nudges/<id>/dismiss` | "Understood — leaving it." |
   | **later** | later / not now / not today / remind me later | `POST /api/ansari/nudges/<id>/snooze` | "No problem — I'll include it in the weekly digest." |
   | **stop these** | stop these / mute / stop reminding me about this | `POST /api/ansari/nudges/<id>/mute` | confirm that *kind* is off, re-enable in Ansari Settings |

### Handling the `apply` response

- `{ "status": "applied", "detail": ... }` → confirm using `detail` ("Done — schedule extended through July 31.").
- `{ "status": "already-handled" }` → say it's already taken care of. Calm, no apology.
- `{ "status": "changed", "nudge": {...} }` → things moved since the nudge was created. Present the **new** proposal from `nudge.intent`/`nudge.action` and ask to confirm again; on yes, `apply` the same `nudge.id`. Never execute the old proposal — only a fresh yes can.
- `{ "status": "handoff", "intent": ..., "topic": ... }` → this action is a conversation, not a one-tap write (Ramadan schedule setup, flyer generation). You're already in the live session — continue right here, using `intent` as your opening context, and start that conversation now.
- HTTP 500 / `{ "status": "error" }` → "I couldn't do that just now — try again in a bit." Don't retry on your own.

---

## Phrasing rules

- **Speak the masjid admin's language, never the engine's.** When the intent
  has a `problem` field, it's already written in plain admin terms — lead with
  it. **Never** surface anything internal in the message — for *any* nudge:
  - the `rule` id (`prayer.iqamah_drift`, `forms.capacity`, …) — it's a routing
    key, never something to say out loud;
  - raw field names or status enums (`breach: "floor"`, `level: "near"`,
    `direction: "back"`, `submissionCount`) — translate them;
  - drift-specific jargon: "drift / floor / breach / 0-minute gap / adhan caught up."

  Talk about what the admin cares about — "there's no time for the congregation
  to gather between the adhan and the start of prayer," not "iqamah drift,
  0-minute gap"; "your signup form is full," not "forms.capacity, level full."
- Every number, date, time, and name comes **verbatim from `intent`**. Never fill
  a gap from memory; if it isn't in the intent, leave it out.
- `action.summary` states **exactly** what an apply does — paraphrase it
  faithfully, never promise more or less.
- Voice per SOUL.md: warm, brief, one ask per message.

### Weekly digest template

The digest intent carries exact figures (`stats`, `upcomingEvents`,
`unresolved`). **Never alter, round, or recompute a figure** — render verbatim,
write only the connective prose around it:

```
📋 This week at the masjid
• Members: {stats.membersTotal} ({stats.membersNewThisMonth} new this month)
• Upcoming: {one line per upcomingEvents item: title — date}{" (no flyer yet)" when hasFlyer is false}
• Still open: {one line per unresolved item, phrased briefly from its intent}
```

Omit a section whose list is empty rather than inventing content. Telegram caps
messages at 4096 chars — if it would run long, keep the first ~8 events and ~10
open items and append "…and more — reply **review** for the rest." One message,
never a thread of fragments.

---

## Hard rules

1. **Replies are only understood inside a review.** Never interpret a stray
   "yes" as acting on a nudge. The admin enters the flow by asking to
   **review**; that pulls the items into the conversation so answers have a
   referent.
2. **The server is the only source of truth.** Recover pending items from
   `/awaiting` — never from memory of an earlier delivery, never re-send a
   nudge the server didn't return.
3. **Confirm before acting**, and never alter figures (digest and nudge numbers
   are verbatim from `intent`).
4. **Stale items are fine.** Apply on an old item always gets a graceful server
   answer (`already-handled` at worst) — relay it plainly.
5. **One thing at a time** (per SOUL.md).
