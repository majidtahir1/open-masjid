# Ansari Web Chat POC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged-in tenant admin types a message at `/admin/ansari`, OpenMasjid relays it to a Hermes profile's HTTP API server over the tailnet, and the agent's reply streams back into the browser.

**Architecture:** A new custom admin page (server component + client chat UI) posts to an OpenMasjid relay route. The relay authenticates the Payload admin session, gates on `role === 'admin'`, and proxies to Hermes `POST /v1/chat/completions` with `stream: true`, piping the SSE body straight back to the browser. The browser holds the message history (stateless relay, multi-turn context for free). For the POC the Hermes endpoint comes from env vars (`HERMES_API_BASE_URL`, `HERMES_API_KEY`); per-tenant routing via `AnsariSettings` is deferred to v1.

**Tech Stack:** Next.js 16 App Router, Payload CMS 3, TypeScript, Tailwind (project CSS vars), Vitest, Hermes-agent OpenAI-compatible API.

---

## File structure

- `src/lib/ansari.ts` — pure helpers: build the Hermes upstream request; authorize an admin user; parse an SSE `data:` line into a content delta. The only logic-bearing unit → fully unit-tested.
- `src/lib/ansari.test.ts` — Vitest unit tests for the helpers.
- `src/app/(payload)/admin/api/ansari/chat/route.ts` — the relay POST handler (thin wiring over `src/lib/ansari.ts`).
- `src/admin/AnsariNavLink.tsx` — sidebar link (mirrors `src/admin/BillingNavLink.tsx`).
- `src/payload.config.ts` — register the nav link in `beforeNavLinks`.
- `src/app/(payload)/admin/ansari/page.tsx` — server component (mirrors `admin/billing/page.tsx`).
- `src/app/(payload)/admin/ansari/AnsariChatClient.tsx` — client chat UI with streaming fetch.
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

## Task 3: Sidebar nav link

**Files:**
- Create: `src/admin/AnsariNavLink.tsx`
- Modify: `src/payload.config.ts` (`beforeNavLinks` array, ~line 87)

- [ ] **Step 1: Create the nav link** (mirrors `src/admin/BillingNavLink.tsx`)

```tsx
// src/admin/AnsariNavLink.tsx
import Link from 'next/link'
import React from 'react'

import { getAdminUser } from '@/lib/admin-context'

export default async function AnsariNavLink() {
  try {
    const { user } = await getAdminUser()
    if (!user) return null
    // Tenant admins only — not platform owners, not congregants.
    if ((user as { role?: string }).role !== 'admin') return null

    return (
      <Link className="nav__link" href="/admin/ansari">
        Ansari
      </Link>
    )
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Register it** — add the component path to the `beforeNavLinks` array in `src/payload.config.ts`:

```ts
      beforeNavLinks: [
        '/src/admin/BillingBanner#default',
        '/src/admin/onboarding/OnboardingBanner#default',
        '/src/admin/DashboardLink#default',
        '/src/admin/donations/DonationsNav#default',
        '/src/admin/membership/MembershipNav#default',
        '/src/admin/AnsariNavLink#default',
      ],
```

- [ ] **Step 3: Regenerate the import map** (Payload needs custom components in the import map):

Run: `npx payload generate:importmap`
Expected: `src/app/(payload)/admin/importMap.js` updated to include `AnsariNavLink`.

- [ ] **Step 4: Commit**

```bash
git add src/admin/AnsariNavLink.tsx src/payload.config.ts "src/app/(payload)/admin/importMap.js"
git commit -m "feat(ansari): add sidebar nav link"
```

---

## Task 4: Chat page (server) + chat UI (client)

**Files:**
- Create: `src/app/(payload)/admin/ansari/page.tsx`
- Create: `src/app/(payload)/admin/ansari/AnsariChatClient.tsx`

- [ ] **Step 1: Create the server page** (mirrors `admin/billing/page.tsx`)

```tsx
// src/app/(payload)/admin/ansari/page.tsx
import { redirect } from 'next/navigation'
import {
  createLocalReq,
  getPayload,
  isEntityHidden,
  type SanitizedPermissions,
  type VisibleEntities,
} from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import config from '@payload-config'
import { getAdminUser } from '@/lib/admin-context'
import { importMap } from '../importMap'
import AnsariChatClient from './AnsariChatClient'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function AnsariPage() {
  const { user, permissions } = await getAdminUser()
  if (!user) redirect('/admin/login')
  if ((user as { role?: string }).role !== 'admin') {
    redirect('/admin')
  }

  const payload = await getPayload({ config, importMap })
  const req = await createLocalReq({ user }, payload)

  const visibleEntities: VisibleEntities = {
    collections: payload.config.collections
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
    globals: payload.config.globals
      .filter(({ admin }) => !isEntityHidden({ hidden: admin?.hidden, user }))
      .map(({ slug }) => slug),
  }

  return (
    <DefaultTemplate
      i18n={req.i18n}
      params={{}}
      payload={payload}
      permissions={permissions as SanitizedPermissions}
      req={req}
      searchParams={{}}
      user={user}
      visibleEntities={visibleEntities}
    >
      <AnsariChatClient />
    </DefaultTemplate>
  )
}
```

- [ ] **Step 2: Create the client chat UI**

```tsx
// src/app/(payload)/admin/ansari/AnsariChatClient.tsx
'use client'

import React, { useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function AnsariChatClient() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    setError(null)
    setInput('')
    const history: Msg[] = [...messages, { role: 'user', content: text }]
    // Optimistically render the user message + an empty assistant bubble.
    setMessages([...history, { role: 'assistant', content: '' }])
    setBusy(true)

    try {
      const res = await fetch('/admin/api/ansari/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      if (!res.ok || !res.body) {
        throw new Error(`relay ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assistant = ''

      // Read SSE: split on blank-line-delimited events, parse `data:` lines.
      // (Parsing mirrors parseSseContentDelta in src/lib/ansari.ts.)
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
            }
            const delta = json.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta.length > 0) {
              assistant += delta
              setMessages([...history, { role: 'assistant', content: assistant }])
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
            }
          } catch {
            // ignore non-JSON / keepalive lines
          }
        }
      }
    } catch {
      setError('Ansari is unreachable right now. Try again in a moment.')
      setMessages(history) // drop the empty assistant bubble
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-80px)] max-w-[880px] flex-col px-6 py-8">
      <h1 className="font-display mb-4 text-3xl text-[var(--icp-navy-700)]">Ansari</h1>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-[var(--theme-elevation-100)] p-4"
      >
        {messages.length === 0 && (
          <p className="text-[var(--icp-gray-700)]">
            Ask Ansari to update prayer times, post an announcement, manage events, and more.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'user' ? 'text-right' : 'text-left'}
          >
            <span
              className={
                'inline-block whitespace-pre-wrap rounded-2xl px-4 py-2 ' +
                (m.role === 'user'
                  ? 'bg-[var(--icp-navy-700)] text-white'
                  : 'bg-[var(--theme-elevation-100)] text-[var(--icp-navy-700)]')
              }
            >
              {m.content || (busy ? '…' : '')}
            </span>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <input
          className="flex-1 rounded-lg border border-[var(--theme-elevation-150)] px-4 py-2"
          placeholder="Message Ansari…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--icp-navy-700)] px-5 py-2 text-white disabled:opacity-50"
          disabled={busy || input.trim() === ''}
        >
          Send
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (If `--icp-*` CSS vars differ in your theme, swap for the nearest existing token — grep `src/admin` for `var(--icp` to confirm names.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(payload)/admin/ansari/page.tsx" "src/app/(payload)/admin/ansari/AnsariChatClient.tsx"
git commit -m "feat(ansari): add admin chat page and streaming UI"
```

---

## Task 5: End-to-end verification (manual, on the tailnet)

- [ ] **Step 1:** Ensure local `.env` has `HERMES_API_BASE_URL` / `HERMES_API_KEY` (Task 0) and the dev machine is on the tailnet.
- [ ] **Step 2:** Run `npm run dev`. Log in to `/admin` as a tenant admin (role `admin`).
- [ ] **Step 3:** Confirm the **Ansari** link appears in the sidebar; open `/admin/ansari`.
- [ ] **Step 4:** Send "What time is Fajr today?" Confirm the reply **streams in** token-by-token and is correct for the tenant.
- [ ] **Step 5:** Send a follow-up ("and Isha?") and confirm multi-turn context works (browser-held history).
- [ ] **Step 6:** Negative checks: log in as a `platformOwner` → no Ansari link, `/admin/ansari` redirects; stop the Hermes gateway → the UI shows the "unreachable" error gracefully.
- [ ] **Step 7:** Run the full test + type-check gate:

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, no type errors.

---

## Out of scope (deferred to v1, per the design doc)

Image upload (flyer-to-event), per-tenant `AnsariSettings` routing + secret store, server-side state via `/v1/responses`, persisted history, inline nudges, web03 network-posture hardening (move off the shared tailnet to outbound-only HTTPS).
