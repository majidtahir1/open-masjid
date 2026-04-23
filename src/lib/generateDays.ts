import { computeAdhanTimes, type AdhanMethod, type AsrMadhab } from './adhan'
import { applyIqamahRule, type IqamahRule } from './iqamah'

export type IqamahRulesShape = Record<
  'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha',
  { mode: 'absolute' | 'offset'; absoluteValue?: string | null; offsetMinutes?: number | null }
>

export interface GenerateDaysInput {
  startDate: string // ISO
  endDate: string // ISO
  lat: number
  lng: number
  timezone: string
  method: AdhanMethod
  madhab: AsrMadhab
  rules: IqamahRulesShape
}

export interface GeneratedDay {
  date: string
  fajr: { adhan: string; iqamah: string }
  zuhr: { adhan: string; iqamah: string }
  asr: { adhan: string; iqamah: string }
  maghrib: { adhan: string; iqamah: string }
  isha: { adhan: string; iqamah: string }
}

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const

export function ruleFor(entry: IqamahRulesShape[keyof IqamahRulesShape]): IqamahRule {
  if (entry.mode === 'offset') return { mode: 'offset', value: entry.offsetMinutes ?? 0 }
  return { mode: 'absolute', value: entry.absoluteValue ?? '' }
}

function* datesInRange(startISO: string, endISO: string): Generator<Date> {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  )
  const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  while (cursor.getTime() <= stop.getTime()) {
    yield new Date(cursor)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
}

export function generateDays(input: GenerateDaysInput): GeneratedDay[] {
  const days: GeneratedDay[] = []
  for (const date of datesInRange(input.startDate, input.endDate)) {
    const adhan = computeAdhanTimes({
      lat: input.lat,
      lng: input.lng,
      timezone: input.timezone,
      method: input.method,
      madhab: input.madhab,
      date,
    })
    const row: GeneratedDay = {
      date: date.toISOString(),
      fajr: { adhan: '', iqamah: '' },
      zuhr: { adhan: '', iqamah: '' },
      asr: { adhan: '', iqamah: '' },
      maghrib: { adhan: '', iqamah: '' },
      isha: { adhan: '', iqamah: '' },
    }
    for (const prayer of PRAYERS) {
      row[prayer] = {
        adhan: adhan[prayer],
        iqamah: applyIqamahRule(ruleFor(input.rules[prayer]), adhan[prayer]),
      }
    }
    days.push(row)
  }
  return days
}
