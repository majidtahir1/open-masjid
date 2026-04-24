'use client'

import { DynamicIcon } from 'lucide-react/dynamic'
import { HandHeart, type LucideIcon, type LucideProps } from 'lucide-react'
import React from 'react'

export interface LucideIconProps extends LucideProps {
  /** Kebab-case icon name (e.g. `hand-heart`). See https://lucide.dev/icons. */
  name?: string | null
  /** Fallback icon when the name is empty or unknown. */
  fallback?: LucideIcon
}

/**
 * Render any Lucide icon by its kebab-case name — lazy-loaded at runtime so
 * we don't bundle all ~1400 icons. Falls back to a sensible default when the
 * name is empty, missing, or not a valid Lucide icon.
 *
 * Client component because DynamicIcon uses useState/useEffect.
 */
export default function LucideIconByName({
  name,
  fallback: Fallback = HandHeart,
  ...rest
}: LucideIconProps) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return <Fallback {...rest} />
  return <DynamicIcon name={trimmed} fallback={Fallback} {...rest} />
}
