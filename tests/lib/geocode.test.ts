import { afterEach, describe, expect, it, vi } from 'vitest'
import { geocodeAddress } from '@/lib/geocode'

describe('geocodeAddress', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns {lat, lng} when Nominatim responds with a result', async () => {
    const mockResponse = new Response(
      JSON.stringify([{ lat: '33.2257', lon: '-96.7969' }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse) as typeof fetch

    const result = await geocodeAddress('861 N Coleman St, Prosper, TX')
    expect(result).toEqual({ lat: 33.2257, lng: -96.7969 })
  })

  it('sends a User-Agent header per Nominatim policy', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('[]', { status: 200 }),
    ) as typeof fetch
    globalThis.fetch = mockFetch

    await geocodeAddress('test')
    const call = (mockFetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]
    const init = call[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('User-Agent')).toMatch(/OpenMasjid/)
  })

  it('returns null when Nominatim returns no results', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('[]', { status: 200 })) as typeof fetch

    const result = await geocodeAddress('zzz nonexistent zzz')
    expect(result).toBeNull()
  })

  it('returns null when Nominatim returns a non-ok status', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('error', { status: 500 })) as typeof fetch

    const result = await geocodeAddress('test')
    expect(result).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValue(new Error('network')) as typeof fetch

    const result = await geocodeAddress('test')
    expect(result).toBeNull()
  })

  it('returns null for empty input', async () => {
    const result = await geocodeAddress('   ')
    expect(result).toBeNull()
  })
})
