# Ansari Web Chat POC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in tenant admin opens a docked IM-style chat widget (bottom-right of any admin page, expandable to a full modal), types a message, OpenMasjid relays it to a Hermes profile's HTTP API server over the tailnet, and the agent's reply streams back into the widget.

**Architecture:** A floating chat **widget** is mounted app-wide via Payload's `admin.components.providers`, so it persists across admin navigation. The widget (client component) posts to an OpenMasjid relay route. The relay authenticates the Payload admin session, gates on `role === 'admin'`, and proxies to Hermes `POST /v1/chat/completions` with `stream: true`, piping the SSE body straight back to the browser. The browser holds the message history (stateless relay, multi-turn context for free). For the POC the Hermes endpoint comes from env vars (`HERMES_API_BASE_URL`, `HERMES_API_KEY`); per-tenant routing via `AnsariSettings` is deferred to v1.

**UI:** Ports the approved mockup (`docs/superpowers/specs/ansari-chat-mockup.html`) — navy/gold launcher bubble → docked 392×560 IM window → expand-to-centered-modal. POC includes: streaming markdown replies, typing indicator, and live tool/skill progress chips from Hermes `hermes.tool.progress` events. The structured confirm-before-write card (with Yes/Cancel buttons) and image-upload wiring are shown in the mockup but **deferred to v1** — in the POC, Ansari's confirmations arrive as normal streamed text.

**Tech Stack:** Next.js 16 App Router, Payload CMS 3, TypeScript, Tailwind (project CSS vars), `react-markdown`, Vitest, Hermes-agent OpenAI-compatible API.

---

## File structure

- `src/lib/ansari.ts` — pure helpers: build the Hermes upstream request; authorize an admin user; parse an SSE `data:` line into a content delta. The only logic-bearing unit → fully unit-tested. (Tool-progress chips are handled best-effort in the widget and confirmed against the live stream in Task 5, since Hermes' `hermes.tool.progress` payload shape isn't documented.)
- `src/lib/ansari.test.ts` — Vitest unit tests for the helpers.
- `src/app/(payload)/admin/api/ansari/chat/route.ts` — the relay POST handler (thin wiring over `src/lib/ansari.ts`).
- `src/admin/ansari/AnsariProvider.tsx` — Payload `providers` entry: renders `{children}` plus the widget, app-wide.
- `src/admin/ansari/AnsariWidget.tsx` — the floating widget (launcher → docked panel → expanded modal), streaming chat client. Ports the mockup.
- `src/admin/ansari/AnsariWidget.module.css` — widget styles ported from the mockup (or Tailwind classes; CSS module keeps the large block out of the TSX).
- `src/payload.config.ts` — register `AnsariProvider` in `admin.components.providers`.
- `.env` (local, not committed) — `HERMES_API_BASE_URL`, `HERMES_API_KEY`.

---

## Task 0: Prerequisite — enable the Hermes API server (manual, your side)

**Not code.** On the Hermes VM, in the running profile's `.env`:

```
API_SERVER_ENABLED=true
API_SERVER_KEY=<long-random-secret>
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
```

Restart the gateway (`hermes gateway`) and verify from the dev machine on the tailnet:

```bash
curl -fsS -H "Authorization: Bearer <key>" http://<tailnet-host>:8642/health
# expected: {"status":"ok"}
curl -fsS -H "Authorization: Bearer <key>" -H "Content-Type: application/json" \
  http://<tailnet-host>:8642/v1/chat/completions \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"say hi"}]}'
# expected: a chat.completion JSON with choices[0].message.content
```

- [ ] **Step 1:** Set the env keys on the Hermes profile and restart `hermes gateway`.
- [ ] **Step 2:** Confirm both curl commands above succeed from the dev machine over the tailnet. Record the working base URL (`http://<tailnet-host>:8642`) and key.
- [ ] **Step 3:** Add them to the local OpenMasjid `.env`:

```
HERMES_API_BASE_URL=http://<tailnet-host>:8642
HERMES_API_KEY=<the same key>
```

---

## Task 1: Hermes helpers (`src/lib/ansari.ts`)

**Files:**
- Create: `src/lib/ansari.ts`
- Test: `src/lib/ansari.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ansari.test.ts
import { describe, it, expect } from 'vitest'
import {
  authorizeAnsari,
  buildHermesChatRequest,
  parseSseContentDelta,
  type ChatMessage,
} from './ansari'

describe('authorizeAnsari', () => {
  it('rejects an unauthenticated user', () => {
    expect(authorizeAnsari(null)).toEqual({ ok: false, status: 401, error: 'unauthenticated' })
  })
  it('rejects a non-admin role', () => {
    expect(authorizeAnsari({ role: 'platformOwner' })).toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
    })
  })
  it('allows a tenant admin', () => {
    expect(authorizeAnsari({ role: 'admin' })).toEqual({ ok: true })
  })
})

describe('buildHermesChatRequest', () => {
  const msgs: ChatMessage[] = [{ role: 'user', content: 'hi' }]
  it('builds the chat/completions URL, bearer auth, and streaming body', () => {
    const { url, init } = buildHermesChatRequest(msgs, {
      baseUrl: 'http://host:8642',
      apiKey: 'secret',
    })
    expect(url).toBe('http://host:8642/v1/chat/completions')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer secret')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body as string)
    expect(body.stream).toBe(true)
    expect(body.messages).toEqual(msgs)
    expect(typeof body.model).toBe('string')
  })
  it('trims a trailing slash on the base URL', () => {
    const { url } = buildHermesChatRequest(msgs, { baseUrl: 'http://host:8642/', apiKey: 'k' })
    expect(url).toBe('http://host:8642/v1/chat/completions')
  })
})

describe('parseSseContentDelta', () => {
  it('extracts an assistant content delta from a data line', () => {
    const line =
      'data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}'
    expect(parseSseContentDelta(line)).toBe('Hello')
  })
  it('returns null for the [DONE] sentinel', () => {
    expect(parseSseContentDelta('data: [DONE]')).toBeNull()
  })
  it('returns null for non-data / empty / keepalive lines', () => {
    expect(parseSseContentDelta('')).toBeNull()
    expect(parseSseContentDelta(': keepalive')).toBeNull()
    expect(parseSseContentDelta('event: chat.completion.chunk')).toBeNull()
  })
  it('returns null when a chunk carries no content (e.g. role-only first chunk)', () => {
    expect(
      parseSseContentDelta('data: {"choices":[{"delta":{"role":"assistant"},"index":0}]}'),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ansari.test.ts`
Expected: FAIL — `Cannot find module './ansari'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/ansari.ts

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type AuthzResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string }

/** Gate the relay: only authenticated tenant admins may use the web chat. */
export function authorizeAnsari(user: { role?: string } | null): AuthzResult {
  if (!user) return { ok: false, status: 401, error: 'unauthenticated' }
  if (user.role !== 'admin') return { ok: false, status: 403, error: 'forbidden' }
  return { ok: true }
}

export type HermesConfig = { baseUrl: string; apiKey: string }

/** Build the upstream request to a Hermes profile's OpenAI-compatible chat endpoint. */
export function buildHermesChatRequest(
  messages: ChatMessage[],
  cfg: HermesConfig,
): { url: string; init: RequestInit } {
  const base = cfg.baseUrl.replace(/\/+$/, '')
  return {
    url: `${base}/v1/chat/completions`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'hermes-agent',
        messages,
        stream: true,
      }),
    },
  }
}

/**
 * Parse one SSE line from /v1/chat/completions stream into an assistant text
 * delta. Returns the text fragment, or null for [DONE], comments, non-data
 * lines, and chunks without content (role-only chunks, tool-progress events).
 */
export function parseSseContentDelta(line: string): string | null {
  const trimmed = line.trimStart()
  if (!trimmed.startsWith('data:')) return null
  const payload = trimmed.slice('data:'.length).trim()
  if (payload === '' || payload === '[DONE]') return null
  try {
    const json = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>
    }
    const content = json.choices?.[0]?.delta?.content
    return typeof content === 'string' && content.length > 0 ? content : null
  } catch {
    return null
  }
}

/** Read Hermes config from env; throws a clear error if unset (POC: single endpoint). */
export function getHermesConfig(): HermesConfig {
  const baseUrl = process.env.HERMES_API_BASE_URL
  const apiKey = process.env.HERMES_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error('HERMES_API_BASE_URL and HERMES_API_KEY must be set')
  }
  return { baseUrl, apiKey }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ansari.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ansari.ts src/lib/ansari.test.ts
git commit -m "feat(ansari): add Hermes chat relay helpers"
```

---

## Task 2: Relay route (`admin/api/ansari/chat/route.ts`)

**Files:**
- Create: `src/app/(payload)/admin/api/ansari/chat/route.ts`

This route is thin wiring over the tested helpers; verify it manually in Task 5 (it depends on `getPayload`, a live session cookie, and a live Hermes — not worth mocking for a POC).

- [ ] **Step 1: Write the route**

```ts
// src/app/(payload)/admin/api/ansari/chat/route.ts
import { NextResponse } from 'next/server'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import {
  authorizeAnsari,
  buildHermesChatRequest,
  getHermesConfig,
  type ChatMessage,
} from '@/lib/ansari'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = { messages?: ChatMessage[] }

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })

  const authz = authorizeAnsari(user as { role?: string } | null)
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages-required' }, { status: 400 })
  }

  let cfg
  try {
    cfg = getHermesConfig()
  } catch {
    return NextResponse.json({ error: 'ansari-not-configured' }, { status: 503 })
  }

  const { url, init } = buildHermesChatRequest(messages, cfg)

  let upstream: Response
  try {
    upstream = await fetch(url, init)
  } catch {
    return NextResponse.json({ error: 'ansari-unreachable' }, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'ansari-error' }, { status: 502 })
  }

  // Pipe Hermes' SSE straight through to the browser.
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(payload\)/admin/api/ansari/chat/route.ts
git commit -m "feat(ansari): add streaming chat relay route"
```

---

## Task 3: Mount the widget app-wide (Payload provider)

**Files:**
- Create: `src/admin/ansari/AnsariProvider.tsx`
- Modify: `src/payload.config.ts` (add `admin.components.providers`)

The `providers` array wraps the whole admin app, so a component placed here renders
on every admin page and persists across navigation — the correct host for a
floating widget. The provider renders `{children}` (the admin app) plus the widget.

- [ ] **Step 1: Create the provider** (renders the real admin app untouched, plus the widget)

```tsx
// src/admin/ansari/AnsariProvider.tsx
import React from 'react'
import AnsariWidget from './AnsariWidget'

// Server component: passes through children, mounts the client widget alongside.
// The widget self-gates to tenant admins (fetches /api/users/me) and the relay
// enforces role server-side, so it is safe to render here unconditionally.
export default function AnsariProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AnsariWidget />
    </>
  )
}
```

- [ ] **Step 2: Register it** — add `providers` under `admin.components` in `src/payload.config.ts` (sibling of the existing `beforeNavLinks`/`afterNavLinks`/`header` keys):

```ts
    components: {
      // ...existing beforeNavLinks / afterNavLinks / header / graphics ...
      providers: ['/src/admin/ansari/AnsariProvider#default'],
    },
```

- [ ] **Step 3: Regenerate the import map**

Run: `npx payload generate:importmap`
Expected: `src/app/(payload)/admin/importMap.js` updated to include `AnsariProvider`.

- [ ] **Step 4: Commit**

```bash
git add src/admin/ansari/AnsariProvider.tsx src/payload.config.ts "src/app/(payload)/admin/importMap.js"
git commit -m "feat(ansari): mount chat widget app-wide via admin provider"
```

---

## Task 4: The chat widget (client)

**Files:**
- Create: `src/admin/ansari/AnsariWidget.tsx`
- Create: `src/admin/ansari/AnsariWidget.module.css`

Port the approved mockup (`docs/superpowers/specs/ansari-chat-mockup.html`) into a
React client component: a launcher bubble, a docked 392×560 IM panel, and an
expand-to-centered-modal toggle, with navy/gold styling from the project palette.
Streaming and markdown are wired to the relay. POC subset of the mockup: launcher,
docked + expanded states, streaming **markdown** replies, typing indicator,
text composer. Deferred to v1 (present in mockup, not wired here): structured
confirm-card buttons and image upload — the attach button renders but is disabled
with a "coming soon" title.

- [ ] **Step 1: Install the markdown renderer**

Run: `npm install react-markdown`
Expected: `react-markdown` added to `dependencies`.

- [ ] **Step 2: Create the widget styles** — copy the CSS from the mockup's
`<style>` block (the launcher / panel / hdr / msgs / bubble / typing / composer
rules) into `src/admin/ansari/AnsariWidget.module.css`, prefixing class usage via
the CSS module. Keep the palette values (`--navy-700:#0F1E4A`, `--gold:#F0C88C`,
etc.) defined at the top of the module so the widget matches the mockup exactly.
(The mockup file is the source of truth for the visual spec — replicate it.)

- [ ] **Step 3: Create the widget component**

```tsx
// src/admin/ansari/AnsariWidget.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import styles from './AnsariWidget.module.css'

type Msg = { role: 'user' | 'assistant'; content: string }
type View = 'closed' | 'docked' | 'expanded'

export default function AnsariWidget() {
  const [allowed, setAllowed] = useState(false)
  const [view, setView] = useState<View>('closed')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [tool, setTool] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Self-gate: only render the launcher for tenant admins.
  useEffect(() => {
    let on = true
    fetch('/api/users/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (on && d?.user?.role === 'admin') setAllowed(true)
      })
      .catch(() => {})
    return () => {
      on = false
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, tool])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setError(null)
    setInput('')
    const history: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setBusy(true)

    try {
      const res = await fetch('/admin/api/ansari/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) throw new Error(`relay ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistant = ''

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const raw of lines) {
          const line = raw.trimStart()
          if (!line.startsWith('data:')) continue
          const payload = line.slice('data:'.length).trim()
          if (payload === '' || payload === '[DONE]') continue
          try {
            const json = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>
              // best-effort: Hermes tool-progress events (shape verified in Task 5)
              hermes?: { tool?: { progress?: string } }
              type?: string
            }
            const delta = json.choices?.[0]?.delta?.content
            const progress = json.hermes?.tool?.progress
            if (typeof progress === 'string') {
              setTool(progress)
            }
            if (typeof delta === 'string' && delta.length > 0) {
              setTool(null)
              assistant += delta
              setMessages([...history, { role: 'assistant', content: assistant }])
            }
          } catch {
            // ignore keepalive / non-JSON lines
          }
        }
      }
    } catch {
      setError('Ansari is unreachable right now. Try again in a moment.')
      setMessages(history)
    } finally {
      setBusy(false)
      setTool(null)
    }
  }

  if (!allowed) return null

  if (view === 'closed') {
    return (
      <button
        className={styles.launcher}
        onClick={() => setView('docked')}
        title="Chat with Ansari"
        aria-label="Chat with Ansari"
      >
        <span className={styles.dot} />
        {/* chat icon — same path as the mockup */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </button>
    )
  }

  const expanded = view === 'expanded'

  return (
    <>
      {expanded && <div className={styles.backdrop} onClick={() => setView('docked')} />}
      <section className={expanded ? `${styles.panel} ${styles.expanded}` : styles.panel}>
        <header className={styles.hdr}>
          <div className={styles.avatar}>A</div>
          <div className={styles.meta}>
            <div className={styles.name}>Ansari</div>
            <div className={styles.status}>Online</div>
          </div>
          <button onClick={() => setView(expanded ? 'docked' : 'expanded')} title={expanded ? 'Restore' : 'Expand'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          </button>
          <button onClick={() => setView('closed')} title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </header>

        <div className={styles.msgs} ref={scrollRef}>
          {messages.length === 0 && (
            <div className={`${styles.row} ${styles.bot}`}>
              <div className={styles.bubble}>
                Assalamu alaikum 👋 I'm Ansari. Ask me to update prayer times, post an
                announcement, manage events, or build a signup form.
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`${styles.row} ${m.role === 'user' ? styles.user : styles.bot}`}>
              <div className={styles.bubble}>
                {m.role === 'assistant' ? (
                  <ReactMarkdown>{m.content || '…'}</ReactMarkdown>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {tool && (
            <div className={styles.tool}>
              <span className={styles.spin} /> {tool}
            </div>
          )}
          {busy && !tool && (
            <div className={`${styles.row} ${styles.bot}`}>
              <div className={styles.typing}><span /><span /><span /></div>
            </div>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <button type="button" className={styles.attach} disabled title="Flyer upload — coming soon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <textarea
            className={styles.textarea}
            rows={1}
            placeholder="Message Ansari…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            disabled={busy}
          />
          <button type="submit" className={styles.send} disabled={busy || input.trim() === ''} title="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </form>
      </section>
    </>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Ensure the CSS module class names referenced in the TSX exist in `AnsariWidget.module.css`.)

- [ ] **Step 5: Commit**

```bash
git add src/admin/ansari/AnsariWidget.tsx src/admin/ansari/AnsariWidget.module.css package.json package-lock.json
git commit -m "feat(ansari): add floating IM chat widget with streaming + markdown"
```

---

## Task 5: End-to-end verification (manual, on the tailnet)

- [ ] **Step 1:** Ensure local `.env` has `HERMES_API_BASE_URL` / `HERMES_API_KEY` (Task 0) and the dev machine is on the tailnet.
- [ ] **Step 2:** Run `npm run dev`. Log in to `/admin` as a tenant admin (role `admin`).
- [ ] **Step 3:** Confirm the **launcher bubble** appears bottom-right on every admin page; click it to open the docked IM window; click expand to confirm the modal state and backdrop.
- [ ] **Step 4:** Send "What time is Fajr today?" Confirm the reply **streams in** token-by-token, renders markdown, and is correct for the tenant.
- [ ] **Step 5:** Send a follow-up ("and Isha?") and confirm multi-turn context works (browser-held history).
- [ ] **Step 5a:** Inspect the live SSE in DevTools → confirm the actual `hermes.tool.progress` payload shape and adjust the widget's progress parsing if it differs from the best-effort `json.hermes.tool.progress` guess; confirm the tool chip appears during a write action (e.g. "change Fajr iqamah to 6:15").
- [ ] **Step 6:** Negative checks: log in as a `platformOwner` → no launcher appears; stop the Hermes gateway → the widget shows the "unreachable" error gracefully.
- [ ] **Step 7:** Run the full test + type-check gate:

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors.

---

## Out of scope (deferred to v1, per the design doc)

Image upload (flyer-to-event) + the structured confirm-before-write card with Yes/Cancel buttons (both shown in the mockup but text-only in the POC), per-tenant `AnsariSettings` routing + secret store, server-side state via `/v1/responses`, persisted history, inline nudges, web03 network-posture hardening (move off the shared tailnet to outbound-only HTTPS).
