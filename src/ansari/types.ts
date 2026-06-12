// src/ansari/types.ts
import type { Payload } from 'payload'
import type { RuleId } from './ruleIds'

export type NudgeTier = 'immediate' | 'digest'
export type NudgeCategory = 'prayer' | 'calendar' | 'forms' | 'announcements' | 'events' | 'digest'

/**
 * What [Yes] would do. 'direct' = idempotent write executed by /apply after
 * re-validation. 'conversation-starter' = multi-step; /apply returns a handoff
 * marker and Hermes continues in the reactive chat flow.
 */
export type ActionDescriptor =
  | { kind: 'direct'; op: string; params: Record<string, unknown>; summary: string }
  | { kind: 'conversation-starter'; topic: string; summary: string }

export type Finding = {
  /** "Is this the SAME problem?" — stable while the problem is unchanged. */
  dedupKey: string
  /** Structured, machine-readable intent — Hermes does the wording. */
  intent: Record<string, unknown>
  action: ActionDescriptor
}

export type NudgeContext = {
  payload: Payload
  tenant: { id: string | number; timezone: string }
  /** Injected, never read from the clock — keeps rules unit-testable. */
  now: Date
}

export type Rule = {
  id: RuleId
  category: NudgeCategory
  tier: NudgeTier
  /** Underlying write scope an API key must hold for /apply to execute. */
  requiredScope?: string
  evaluate(ctx: NudgeContext): Promise<Finding[]>
  /** Only for rules whose action kind is 'direct'. */
  execute?(ctx: NudgeContext, finding: Finding): Promise<{ ok: true; detail: string }>
}
