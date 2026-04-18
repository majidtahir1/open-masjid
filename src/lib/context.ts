'use client'

import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from 'react'
import type { TenantRecord } from './tenant-parse'

/**
 * Client-side tenant context.
 *
 * Flow:
 *   1. The root server layout resolves the tenant via
 *      `resolveTenantFromHost()` (Node runtime, Payload query).
 *   2. The layout renders `<TenantProvider value={tenant}>...</TenantProvider>`
 *      so every client component in the tree can call `useTenant()`.
 *   3. For pages that don't need tenant data (platform marketing,
 *      platform admin, localhost during dev), the provider receives `null`
 *      and `useTenant()` returns `null`.
 */

const TenantContext = createContext<TenantRecord | null>(null)

export interface TenantProviderProps {
  tenant: TenantRecord | null
  children: ReactNode
}

export function TenantProvider({ tenant, children }: TenantProviderProps) {
  return createElement(TenantContext.Provider, { value: tenant }, children)
}

/**
 * Read the current tenant in a client component. Returns `null` when there
 * is no tenant in the current context (e.g. platform marketing / admin).
 */
export function useTenant(): TenantRecord | null {
  return useContext(TenantContext)
}

/**
 * Same as `useTenant` but throws if no tenant is present. Use in
 * components that are only ever rendered inside a tenant-scoped layout.
 */
export function useRequiredTenant(): TenantRecord {
  const tenant = useContext(TenantContext)
  if (!tenant) {
    throw new Error(
      'useRequiredTenant() called outside a tenant-scoped layout. ' +
        'Ensure the component tree is wrapped with <TenantProvider tenant={...}> ' +
        'and that the current request resolves to a tenant.',
    )
  }
  return tenant
}
