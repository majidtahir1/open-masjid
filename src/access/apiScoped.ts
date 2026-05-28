import type { PayloadRequest } from 'payload'

type UserWithStrategy = { _strategy?: string } | null | undefined

export const isApiKeyAuth = (req: PayloadRequest): boolean => {
  const user = req.user as UserWithStrategy
  return user?._strategy === 'api-key'
}
