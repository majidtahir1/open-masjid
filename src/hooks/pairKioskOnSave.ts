import type { CollectionBeforeChangeHook } from 'payload'

// Real pairing logic added in Task 9.
export const pairKioskOnSave: CollectionBeforeChangeHook = async ({ data }) => {
  return data
}
