# Parent Self-Checkin Kiosk — Feature Spec

**Status:** Draft for designer handoff
**Date:** 2026-06-18
**Author:** Brainstormed with Majid Tahir
**Product area:** OpenMasjid → Programs / Sunday School

---

## 1. Summary

An iPad runs in **kiosk mode at the entrance** of a masjid's school/program. When a
parent drops a child off, they look up their family, tap **Check in** next to the
child's name, and leave. At pickup, they return to the iPad and tap **Check out**.

The kiosk turns drop-off/pickup into self-service and gives staff accurate
**arrival and departure times** per child — without a teacher manually marking a
roster. It writes into the **same attendance records** teachers already use, so
there is one source of truth.

---

## 2. Goals & non-goals

### Goals
- Let parents check a child **in** and **out** in **2–3 taps**, no login.
- Protect privacy: a parent only ever sees **their own family's** children.
- Record **check-in and check-out timestamps**, not just present/absent.
- Feed the existing attendance system (status flips to **present** on check-in).
- Give staff a **live view** of who is currently in the building.
- Run unattended on an iPad in Guided Access / kiosk mode (no admin chrome, no auth screen).

### Non-goals (this version)
- No per-family PIN (phone-number lookup only — schema leaves room to add a PIN later).
- No payments, tuition, or registration at the kiosk.
- No per-classroom devices — one entrance kiosk covers the whole program.
- No facial recognition, badges, or QR scanning.
- No SMS/push notifications to parents on check-in/out (possible future).

---

## 3. Context & key decisions

These were settled during brainstorming and constrain the design:

| Decision | Choice |
|---|---|
| **Who can find a child** | Parent enters a **phone number**; kiosk shows only children whose guardian phone matches. |
| **What a check-in covers** | **Building-level** — checking in marks the child **present for every class meeting today**, all stamped with the same check-in time. Check-out closes them all. |
| **Data model** | Extend the existing `attendance-records` with check-in/out timestamps. The kiosk and the teacher's "Take Attendance" page write the **same record**. |
| **Device setup** | **No device pairing.** Staff opens a kiosk URL, enters an admin PIN once to bind the iPad to a **program**, persisted in `localStorage`. |
| **Lookup key** | **Phone number** (normalized). Works with existing guardian data on day one. |
| **Staff visibility** | **Both** — check-in/out times shown on the existing Take Attendance page, **and** a new dedicated "Who's Here" live dashboard. |

---

## 4. Primary user flows

### 4.1 Drop-off (check-in)
1. Kiosk shows the **idle/welcome screen** (program name, "Drop-off & pickup").
2. Parent taps **Start** (or the screen wakes on tap).
3. **Phone entry screen** — parent types their phone on a large numeric keypad.
4. Kiosk looks up the family → **"Your children" screen** lists each child with a
   status pill and a single big action button.
5. Parent taps **Check in** next to a child (or **Check in all** for siblings).
6. Button animates to a confirmed state; status pill flips to **● Checked in 9:42 AM**.
7. Parent taps **Done** (or the screen **auto-returns to idle after ~20s** of inactivity).

### 4.2 Pickup (check-out)
Same path. On the "Your children" screen, a checked-in child shows a **Check out**
button. Tapping it stamps the check-out time and the pill flips to
**Checked out 12:15 PM**.

### 4.3 First-run device binding (staff, once per iPad)
1. Staff opens the kiosk URL on the iPad.
2. Prompted for the **kiosk URL/PIN** and to pick a **program**.
3. On success, a scoped kiosk token + program are saved to `localStorage`; the iPad
   is now a check-in kiosk for that program until reset.

---

## 5. Screen-by-screen spec

> Visual styling is the designer's call. Below are the required screens, their
> states, and the content each must convey. Large touch targets and high contrast
> throughout — this is used quickly, at arm's length, by people of all ages.

### Screen 1 — Idle / Welcome
- Masjid name + program name (e.g. "Sunday School").
- Friendly prompt: "Tap to check your child in or out."
- Big single **Start** affordance (or whole-screen tap).
- Optionally shows current date and a live count ("18 children checked in").

### Screen 2 — Phone entry
- Title: "Enter your phone number."
- Large **numeric keypad** (0–9, delete, clear) — not the iOS keyboard.
- Masked/formatted display as they type: `(214) 555-0123`.
- **Continue** button (enabled at 10 digits).
- **Cancel / back to start.**
- Error state: "We couldn't find a family with that number. Check with a volunteer." + retry.

### Screen 3 — Your children (the core screen)
- Greeting: "Salam, [family] 👋" + program name.
- One row/card **per child** in the family who is **enrolled in this program**, each showing:
  - Child's name (large).
  - Secondary line: grade and/or class names today.
  - **Status pill**, one of:
    - `○ Not yet arrived`
    - `● Checked in 9:42 AM` (green)
    - `Checked out 12:15 PM` (muted)
  - **Action button**, contextual:
    - Not arrived → **Check in** (green)
    - Checked in → **Check out** (red/amber)
    - Checked out → re-**Check in** allowed (handles re-entry); see §7.
- **"Check in all"** convenience action when ≥2 children can be checked in.
- **Done** button + inactivity auto-timeout back to idle.
- **Layout direction:** brainstorm favored **big cards with one large button per child**,
  optionally with a top "Check in all." Designer to finalize; mockups A/B/C are in
  `.superpowers/brainstorm/` for reference.

### Screen 4 — Confirmation (lightweight)
- Not necessarily a separate screen — inline confirmation on the button + pill is
  preferred. A brief full-screen "✓ Yusuf checked in — JazakAllah khair" toast is
  acceptable before auto-return.

### Edge / empty states (see §7)
- Family found but **no children enrolled in this program**.
- Child has **no session today** (program doesn't meet today).
- Network error / write failed.

---

## 6. Data model (engineering reference)

Existing relevant collections (do not redesign): `terms` (a *program*),
`school-classes`, `class-sessions`, `students` (with `guardians[]` incl. phone),
`enrollments`, `attendance-records` (unique per `[tenant, session, student]`,
`status` = present/absent/late/excused).

### Changes
1. **`attendance-records`** — add fields:
   - `checkInAt` (date, nullable)
   - `checkOutAt` (date, nullable)
   - `checkInBy` (select/text: `kiosk` | `staff`, or guardian label) — provenance
   - On kiosk check-in: upsert the record, set `status = present` + `checkInAt = now`.
   - On kiosk check-out: set `checkOutAt = now`.
2. **Check-in resolution (building-level):** given a student + program + today's date,
   find all `class-sessions` dated today for classes the student is **actively
   enrolled** in, and upsert an attendance record per session with the **same**
   `checkInAt` timestamp.
3. **Phone lookup:** normalize input (strip non-digits, compare last 10) against
   `students.guardians[].phone`; return the student set for matching guardians,
   filtered to active enrollments in the kiosk's program.
4. **Schema headroom:** leave space for a future `familyPin` without rework.

### API / auth
- Public, tenant-scoped kiosk endpoints (Node runtime, `overrideAccess: true`),
  **not** the admin cookie session — a parent kiosk has no logged-in user.
- The first-run bind step authenticates with an **admin/school_admin PIN** and mints
  a **scoped, long-lived kiosk token** (bound to tenant + program) stored in
  `localStorage`. The check-in/out endpoints validate this token and permit **only**
  check-in/out operations, rate-limited.
- ⚠️ **Security tradeoff to review:** this is lighter than the existing prayer-display
  device-pairing/secret model. Phone numbers are guessable, so confidentiality of the
  roster relies partly on staff supervision at the door. Acceptable for a supervised
  entrance kiosk; flagged here for explicit sign-off.

---

## 7. Edge cases & rules

| Case | Behavior |
|---|---|
| Phone matches **no family** | Friendly "not found" + "see a volunteer." Never reveal whether a number exists beyond the lookup result. |
| Family found, **no kids in this program** | "No children enrolled in [program]." with a volunteer prompt. |
| Child has **no session today** | Show the child but disable check-in with "No class today," OR omit — designer/PM to pick (default: omit children with nothing today). |
| **Already checked in**, parent taps again | No duplicate; button already shows Check out. |
| **Re-entry** (checked out, returns) | Allow re-check-in; record a new `checkInAt` (keep last in/out; full event log is a future enhancement). |
| **Multiple guardians**, different phones | Any guardian's phone surfaces the same children. |
| **Two unrelated families share a phone** (rare) | Both families' children appear; acceptable given supervision. Note for PM. |
| **Network/write failure** | Optimistic UI must roll back with a clear "Couldn't save — try again." Never show a false ✓. |
| **Idle mid-flow** | Auto-return to idle after ~20s; never leave one family's roster on screen. |

---

## 8. Staff-facing views

### 8.1 Take Attendance (enhance existing page)
- Show **check-in / check-out times** and a **"still here"** indicator per student,
  alongside the existing present/absent/late/excused controls.
- Teacher edits still work and share the same record.

### 8.2 "Who's Here" live dashboard (new)
- Program-wide live roster + counts: **Checked in / Checked out / Not arrived**.
- Good on a back-office monitor; useful for headcounts and fire drills.
- Read-only; auto-refreshing.

---

## 9. Design direction notes (for the designer)

- **Audience:** parents of all ages and tech comfort, in a hurry, often holding a
  child. Optimize for glanceability and forgiving taps.
- **Touch targets:** large buttons, generous spacing, no small toggles.
- **Color semantics:** green = checked in / good, red or amber = check out / action,
  muted/grey = checked out or not arrived. Keep accessible contrast.
- **Tone/copy:** warm and Islamic-friendly ("Salam", "JazakAllah khair") but concise.
- **Kiosk constraints:** full-screen, no browser chrome, no scrollbars where avoidable,
  works in iPad Guided Access. Assume landscape; design portrait as a bonus.
- **Branding:** should pick up the tenant's masjid name/program; keep it neutral enough
  to fit any masjid's identity.
- **Reference mockups:** A (big cards), B (compact list + check-in-all), C (hybrid) live
  in `.superpowers/brainstorm/68407-1781837335/content/children-screen.html`.

---

## 10. Open questions

1. Should children with **no session today** be hidden or shown-but-disabled? (default: hidden)
2. Do we need a **full in/out event log** for audit, or is last-in/last-out enough for v1? (default: last-in/out)
3. Should staff get an **alert** for kids still checked in after the program ends? (future)
4. Confirm the **security tradeoff** in §6 is acceptable for launch, or do we want the
   full device-pairing/secret flow instead of PIN-bind?
5. Future: per-family **PIN** and/or **SMS confirmation** to the guardian on check-in?
