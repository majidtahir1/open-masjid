import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Each hero `style` variant has a built-in color treatment that matches the
 * design kit. If the user hasn't actively chosen an accent (or left the form
 * default in place when picking a non-default style), set the accent to match
 * the variant. Explicit accent choices are always preserved.
 */
const STYLE_TO_DEFAULT_ACCENT: Record<string, string> = {
  original: 'cream',
  split: 'cream',
  live: 'cream',
  photo: 'navy',
}

export const applyHeroStyleDefaults: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
}) => {
  const style = (data?.style as string) ?? 'original'
  const desiredAccent = STYLE_TO_DEFAULT_ACCENT[style]
  if (!desiredAccent) return data

  const incomingAccent = data?.accent as string | undefined
  const previousStyle = (originalDoc?.style as string) ?? 'original'
  const previousAccent = (originalDoc?.accent as string) ?? 'cream'

  if (operation === 'create') {
    // On create, only override if the user left accent at the form default.
    if (!incomingAccent || incomingAccent === 'cream') {
      return { ...data, accent: desiredAccent }
    }
    return data
  }

  // On update: only auto-flip when the user changed style AND the accent still
  // matches the previous style's default. If they had an intentional accent,
  // don't surprise them.
  if (style !== previousStyle && incomingAccent === STYLE_TO_DEFAULT_ACCENT[previousStyle] && incomingAccent === previousAccent) {
    return { ...data, accent: desiredAccent }
  }

  return data
}
