export interface IqamahPoint {
  name: string
  label: string // human display, e.g. "5:45 AM"
  minutes: number // minutes since local midnight
}

export interface SalahStateArgs {
  now: Date
  iqamahs: IqamahPoint[]
  holdoverMinutes: number
  manualUntil: string | null
  manualClearedAt: string | null
}

export interface SalahState {
  active: boolean
  prayerName: string | null
  iqamahLabel: string | null
}

const INACTIVE: SalahState = { active: false, prayerName: null, iqamahLabel: null }

export function computeSalahState(args: SalahStateArgs): SalahState {
  const { now, iqamahs, holdoverMinutes, manualUntil, manualClearedAt } = args

  // Manual takeover takes precedence: active while now is before manualUntil,
  // unless an explicit "End now" (manualClearedAt) happened at/after the trigger.
  if (manualUntil) {
    const until = new Date(manualUntil).getTime()
    const triggeredAt = until - holdoverMinutes * 60_000
    const cleared = manualClearedAt ? new Date(manualClearedAt).getTime() : null
    const wasCleared = cleared !== null && cleared >= triggeredAt
    if (now.getTime() < until && !wasCleared) {
      return { active: true, prayerName: null, iqamahLabel: null }
    }
  }

  // Auto: within holdover minutes after any prayer's iqamah — unless an admin
  // pressed "End now" (manualClearedAt) at or after this prayer's iqamah today,
  // which ends the takeover for the rest of this window. Without this check the
  // auto trigger re-asserts "active" on every 5s poll and "End now" appears to
  // do nothing for an auto-triggered takeover.
  const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  const clearedAt = manualClearedAt ? new Date(manualClearedAt).getTime() : null
  for (const p of iqamahs) {
    if (nowMin >= p.minutes && nowMin < p.minutes + holdoverMinutes) {
      const windowStart = new Date(now)
      windowStart.setHours(Math.floor(p.minutes / 60), p.minutes % 60, 0, 0)
      if (clearedAt !== null && clearedAt >= windowStart.getTime()) {
        return INACTIVE
      }
      return { active: true, prayerName: p.name, iqamahLabel: p.label }
    }
  }
  return INACTIVE
}
