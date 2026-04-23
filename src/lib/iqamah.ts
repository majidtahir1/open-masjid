export type IqamahRule =
  | { mode: 'absolute'; value: string }
  | { mode: 'offset'; value: number }

function parseTime(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hour = parseInt(match[1], 10)
  const minute = parseInt(match[2], 10)
  const isPm = match[3].toUpperCase() === 'PM'
  if (hour === 12) hour = 0
  if (isPm) hour += 12
  return hour * 60 + minute
}

function formatTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440
  const hour24 = Math.floor(normalized / 60)
  const minute = normalized % 60
  const isPm = hour24 >= 12
  let hour12 = hour24 % 12
  if (hour12 === 0) hour12 = 12
  const mm = minute.toString().padStart(2, '0')
  return `${hour12}:${mm} ${isPm ? 'PM' : 'AM'}`
}

export function applyIqamahRule(rule: IqamahRule, adhan: string): string {
  if (rule.mode === 'absolute') return rule.value || ''
  const base = parseTime(adhan)
  if (base === null) return ''
  return formatTime(base + rule.value)
}
