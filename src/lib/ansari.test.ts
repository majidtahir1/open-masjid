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
