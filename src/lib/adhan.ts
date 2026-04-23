import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from 'adhan'

export type AdhanMethod =
  | 'ISNA'
  | 'MWL'
  | 'Egyptian'
  | 'UmmAlQura'
  | 'Karachi'
  | 'Tehran'
  | 'Jafari'

export type AsrMadhab = 'Standard' | 'Hanafi'

export interface AdhanInput {
  lat: number
  lng: number
  timezone: string // IANA
  method: AdhanMethod
  madhab: AsrMadhab
  date: Date
}

export interface AdhanTimes {
  fajr: string
  /** Sunrise — marks the end of the Fajr prayer window. */
  sunrise: string
  zuhr: string
  asr: string
  maghrib: string
  isha: string
}

const METHOD_MAP: Record<AdhanMethod, () => CalculationParameters> = {
  ISNA: () => CalculationMethod.NorthAmerica(),
  MWL: () => CalculationMethod.MuslimWorldLeague(),
  Egyptian: () => CalculationMethod.Egyptian(),
  UmmAlQura: () => CalculationMethod.UmmAlQura(),
  Karachi: () => CalculationMethod.Karachi(),
  Tehran: () => CalculationMethod.Tehran(),
  Jafari: () => CalculationMethod.Other(),
}

function formatTime(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  }).format(d)
}

export function computeAdhanTimes(input: AdhanInput): AdhanTimes {
  const coords = new Coordinates(input.lat, input.lng)
  const params = METHOD_MAP[input.method]()
  params.madhab = input.madhab === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi
  const prayerTimes = new PrayerTimes(coords, input.date, params)

  return {
    fajr: formatTime(prayerTimes.fajr, input.timezone),
    sunrise: formatTime(prayerTimes.sunrise, input.timezone),
    zuhr: formatTime(prayerTimes.dhuhr, input.timezone),
    asr: formatTime(prayerTimes.asr, input.timezone),
    maghrib: formatTime(prayerTimes.maghrib, input.timezone),
    isha: formatTime(prayerTimes.isha, input.timezone),
  }
}
