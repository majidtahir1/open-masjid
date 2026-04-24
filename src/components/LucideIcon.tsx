'use client'

import { DynamicIcon } from 'lucide-react/dynamic'
import { HandHeart, type LucideProps } from 'lucide-react'
import React from 'react'

export interface LucideIconProps extends LucideProps {
  /** Kebab-case icon name (e.g. `hand-heart`). See https://lucide.dev/icons. */
  name?: string | null
  /**
   * Kebab-case name to render when `name` is empty or unresolvable.
   * Passed as a string (not a component) so this prop is safe to set from
   * a Server Component — React components aren't serializable across the
   * RSC boundary. Defaults to a built-in HandHeart when omitted.
   */
  fallbackName?: string | null
}

/**
 * Render any Lucide icon by its kebab-case name — lazy-loaded at runtime so
 * we don't bundle all ~1,400 icons.
 *
 * Client component because DynamicIcon uses useState/useEffect.
 */
export default function LucideIconByName({
  name,
  fallbackName,
  ...rest
}: LucideIconProps) {
  const trimmed = (name ?? '').trim()
  const fallbackTrimmed = (fallbackName ?? '').trim()

  if (trimmed) {
    return <DynamicIcon name={trimmed} fallback={HandHeart} {...rest} />
  }
  if (fallbackTrimmed) {
    return <DynamicIcon name={fallbackTrimmed} fallback={HandHeart} {...rest} />
  }
  return <HandHeart {...rest} />
}
