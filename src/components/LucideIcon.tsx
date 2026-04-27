'use client'

import { DynamicIcon, type IconName } from 'lucide-react/dynamic'
import { HandHeart, type LucideProps } from 'lucide-react'
import React from 'react'

export interface LucideIconProps extends Omit<LucideProps, 'name'> {
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

  // DynamicIcon types `name` as the literal union of kebab-case Lucide names
  // and `fallback` as a no-arg component. Cast through unknown — we validate
  // the shape on save (kebab-case regex) and DynamicIcon falls back at runtime
  // if a name doesn't resolve.
  const fallback = HandHeart as unknown as () => React.ReactElement

  if (trimmed) {
    return <DynamicIcon name={trimmed as IconName} fallback={fallback} {...rest} />
  }
  if (fallbackTrimmed) {
    return (
      <DynamicIcon name={fallbackTrimmed as IconName} fallback={fallback} {...rest} />
    )
  }
  return <HandHeart {...rest} />
}
