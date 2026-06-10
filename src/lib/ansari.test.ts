import { describe, it, expect } from 'vitest'
import {
  authorizeAnsari,
  buildHermesResponsesRequest,
  parseResponsesSseEvent,
  getHermesConfig,
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

describe('buildHermesResponsesRequest', () => {
  it('builds the /v1/responses URL, bearer auth, and streaming body', () => {
    const { url, init } = buildHermesResponsesRequest('salaam', null, {
      baseUrl: 'http://host:8642',
      apiKey: 'secret',
    })
    expect(url).toBe('http://host:8642/v1/responses')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer secret')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body as string)
    expect(body.stream).toBe(true)
    expect(body.input).toBe('salaam')
    expect('previous_response_id' in body).toBe(false)
  })
  it('chains previous_response_id when provided', () => {
    const { init } = buildHermesResponsesRequest('next turn', 'resp_abc123', {
      baseUrl: 'http://host:8642',
      apiKey: 'k',
    })
    const body = JSON.parse(init.body as string)
    expect(body.previous_response_id).toBe('resp_abc123')
  })
  it('trims a trailing slash on the base URL', () => {
    const { url } = buildHermesResponsesRequest('hi', null, {
      baseUrl: 'http://host:8642/',
      apiKey: 'k',
    })
    expect(url).toBe('http://host:8642/v1/responses')
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

describe('parseResponsesSseEvent', () => {
  it('extracts a text delta from an output_text.delta event', () => {
    const line = 'data: {"type":"response.output_text.delta","output_index":0,"delta":"Hello"}'
    expect(parseResponsesSseEvent(line)).toEqual({ kind: 'delta', text: 'Hello' })
  })
  it('extracts the response id from a response.completed event', () => {
    const line =
      'data: {"type":"response.completed","response":{"id":"resp_2d1c0c","status":"completed"}}'
    expect(parseResponsesSseEvent(line)).toEqual({ kind: 'completed', responseId: 'resp_2d1c0c' })
  })
  it('returns null for the [DONE] sentinel', () => {
    expect(parseResponsesSseEvent('data: [DONE]')).toBeNull()
  })
  it('returns null for non-data / empty / keepalive / event-name lines', () => {
    expect(parseResponsesSseEvent('')).toBeNull()
    expect(parseResponsesSseEvent(': keepalive')).toBeNull()
    expect(parseResponsesSseEvent('event: response.output_text.delta')).toBeNull()
  })
  it('returns null for lifecycle events that carry no text', () => {
    expect(
      parseResponsesSseEvent('data: {"type":"response.created","response":{"id":"resp_x"}}'),
    ).toBeNull()
    expect(
      parseResponsesSseEvent('data: {"type":"response.output_text.done","text":"Hello"}'),
    ).toBeNull()
  })
  it('returns null for malformed JSON', () => {
    expect(parseResponsesSseEvent('data: {nope')).toBeNull()
  })
})
