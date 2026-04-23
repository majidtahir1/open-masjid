import type { CollectionBeforeChangeHook } from 'payload'

import { geocodeAddress } from '@/lib/geocode'

/**
 * If the tenant's address changed and lat/lng are empty, geocode via Nominatim.
 * Admin can always override lat/lng manually — the hook only fills blanks.
 */
export const geocodeTenantAddress: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
}) => {
  const address = (data?.contactInfo as { address?: string } | undefined)?.address
  const location = (data?.location as { lat?: number; lng?: number } | undefined) ?? {}
  const previousAddress = (
    originalDoc?.contactInfo as { address?: string } | undefined
  )?.address

  if (!address) return data
  if (location.lat && location.lng) return data
  if (operation === 'update' && address === previousAddress) return data

  const coords = await geocodeAddress(address)
  if (!coords) return data

  data.location = {
    ...location,
    lat: coords.lat,
    lng: coords.lng,
  }
  return data
}
