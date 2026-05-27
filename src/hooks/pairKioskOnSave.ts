import type { CollectionBeforeChangeHook } from 'payload'
import { isValidPairingCode, normalizePairingCode } from '../lib/kiosk/pairingCode'

/**
 * When admin types a pairing code into a Kiosks record, normalize it and
 * stamp a 15-minute expiry. The deviceId + secret are minted server-side
 * in `/api/kiosk/claim` when the physical kiosk polls in with the matching code.
 */
export const pairKioskOnSave: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
}) => {
  if (operation === 'create' || !data?.pairingCode) return data

  const raw = String(data.pairingCode).trim()
  if (!raw) {
    return { ...data, pairingCode: null, pairingCodeExpiresAt: null }
  }

  const normalized = normalizePairingCode(raw)
  if (!isValidPairingCode(normalized)) {
    throw new Error('Invalid pairing code format. Expected ABC-123.')
  }

  if (originalDoc?.pairingCode === normalized && originalDoc?.pairingCodeExpiresAt) {
    return { ...data, pairingCode: normalized }
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
  return {
    ...data,
    pairingCode: normalized,
    pairingCodeExpiresAt: expiresAt.toISOString(),
  }
}
