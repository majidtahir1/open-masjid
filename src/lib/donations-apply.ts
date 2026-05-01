import type { Payload } from 'payload'
import type { DonationAction } from './donations-webhook'

export async function applyDonationAction(
  _payload: Payload,
  _action: DonationAction,
): Promise<void> {}
