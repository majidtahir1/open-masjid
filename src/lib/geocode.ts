/**
 * Nominatim (OpenStreetMap) geocoder. Free, no API key.
 *
 * Per Nominatim Usage Policy, callers MUST identify themselves via a
 * meaningful User-Agent. See https://operations.osmfoundation.org/policies/nominatim/
 *
 * Rate limit: 1 req/sec sustained. For a masjid admin saving their address
 * once, that ceiling is irrelevant.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'OpenMasjid/1.0 (https://openmasjid.app)'

export interface Coordinates {
  lat: number
  lng: number
}

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  if (!address || !address.trim()) return null

  const url = new URL(NOMINATIM_URL)
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
    })
    if (!res.ok) return null

    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>
    const first = data[0]
    if (!first || !first.lat || !first.lon) return null

    const lat = parseFloat(first.lat)
    const lng = parseFloat(first.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    return { lat, lng }
  } catch {
    return null
  }
}
