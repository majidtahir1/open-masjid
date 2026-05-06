import type { FormSchema, Field } from './form-schema'

export interface Appearance {
  displayMode?: 'all-at-once' | 'one-per-page'
  introMessage?: unknown
  submissionMessage?: unknown
  backgroundColor?: string | null
  backgroundGradient?: {
    from?: string | null
    to?: string | null
    direction?: 'vertical' | 'horizontal' | 'diagonal' | null
  } | null
}

const DIRECTION_TO_DEG = {
  vertical: '180deg',
  horizontal: '90deg',
  diagonal: '135deg',
} as const

export function computeBackgroundCss(appearance: Appearance | undefined): string | undefined {
  if (!appearance) return undefined
  const grad = appearance.backgroundGradient
  if (grad?.from) {
    const direction = (grad.direction ?? 'vertical') as keyof typeof DIRECTION_TO_DEG
    const deg = DIRECTION_TO_DEG[direction] ?? DIRECTION_TO_DEG.vertical
    const to = grad.to || grad.from
    return `linear-gradient(${deg}, ${grad.from}, ${to})`
  }
  if (appearance.backgroundColor) return appearance.backgroundColor
  return undefined
}

export function flattenStepsForOnePerPage(schema: FormSchema): FormSchema {
  const out: FormSchema = { steps: [] }
  for (const step of schema.steps) {
    for (const f of step.fields as Field[]) {
      if (f.type === 'page-break') continue
      out.steps.push({ id: `vstep-${f.id}`, fields: [f] })
    }
  }
  return out
}

interface MessageHolder {
  appearance?: { submissionMessage?: unknown } | null
  settings?: { successMessage?: unknown } | null
}

export function resolveSubmissionMessage(form: MessageHolder): unknown | null {
  return form.appearance?.submissionMessage ?? form.settings?.successMessage ?? null
}
