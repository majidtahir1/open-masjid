import { describe, it, expect } from 'vitest'
import {
  authorizeAnsari,
  buildHermesChatRequest,
  parseSseContentDelta,
  getHermesConfig,
  trimChatHistory,
  ANSARI_MAX_HISTORY_MESSAGES,
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
    expect(body.model).toBe('hermes-agent')
  })
  it('trims a trailing slash on the base URL', () => {
    const { url } = buildHermesChatRequest(msgs, { baseUrl: 'http://host:8642/', apiKey: 'k' })
    expect(url).toBe('http://host:8642/v1/chat/completions')
  })
})

describe('getHermesConfig', () => {
  it('throws when env vars are absent', () => {
    delete process.env.HERMES_API_BASE_URL
    delete process.env.HERMES_API_KEY
    expect(() => getHermesConfig()).toThrow('must be set')
  })
  it('returns config from env', () => {
    process.env.HERMES_API_BASE_URL = 'http://h'
    process.env.HERMES_API_KEY = 'k'
    expect(getHermesConfig()).toEqual({ baseUrl: 'http://h', apiKey: 'k' })
    delete process.env.HERMES_API_BASE_URL
    delete process.env.HERMES_API_KEY
  })
})

describe('trimChatHistory', () => {
  const turn = (i: number): ChatMessage[] => [
    { role: 'user', content: `q${i}` },
    { role: 'assistant', content: `a${i}` },
  ]

  it('returns short histories unchanged', () => {
    const msgs = [...turn(1), ...turn(2), { role: 'user' as const, content: 'q3' }]
    expect(trimChatHistory(msgs, 6)).toEqual(msgs)
  })

  it('keeps only the most recent messages when over the cap', () => {
    const msgs = [...turn(1), ...turn(2), ...turn(3), { role: 'user' as const, content: 'q4' }]
    expect(trimChatHistory(msgs, 3)).toEqual([
      { role: 'user', content: 'q3' },
      { role: 'assistant', content: 'a3' },
      { role: 'user', content: 'q4' },
    ])
  })

  it('drops a leading orphaned assistant message after trimming', () => {
    const msgs = [...turn(1), ...turn(2), { role: 'user' as const, content: 'q3' }]
    // cap of 2 would start the window on a2 (assistant) — drop it so the
    // history opens with a user turn
    expect(trimChatHistory(msgs, 2)).toEqual([{ role: 'user', content: 'q3' }])
  })

  it('exports a sane default cap', () => {
    expect(ANSARI_MAX_HISTORY_MESSAGES).toBeGreaterThanOrEqual(10)
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
