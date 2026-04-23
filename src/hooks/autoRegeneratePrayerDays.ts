import type { CollectionBeforeChangeHook } from 'payload'

import type { AdhanMethod, AsrMadhab } from '@/lib/adhan'
import { applyIqamahRule } from '@/lib/iqamah'
import {
  generateDays,
  ruleFor,
  type IqamahRulesShape,
} from '@/lib/generateDays'

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const

type DayRow = {
  date?: string | null
  fajr?: { adhan?: string | null; iqamah?: string | null } | null
  zuhr?: { adhan?: string | null; iqamah?: string | null } | null
  asr?: { adhan?: string | null; iqamah?: string | null } | null
  maghrib?: { adhan?: string | null; iqamah?: string | null } | null
  isha?: { adhan?: string | null; iqamah?: string | null } | null
  [k: string]: unknown
}

function extractId(rel: unknown): string | number | null {
  if (rel == null) return null
  if (typeof rel === 'object' && 'id' in rel) {
    return (rel as { id: string | number }).id
  }
  return rel as string | number
}

/**
 * Keeps days[] in sync with the schedule's range + iqamah rules automatically.
 *
 * - Range changed (startDate or endDate differs from the saved doc): full
 *   regenerate using the tenant's location + calc method.
 * - Only iqamah rules changed: re-apply rules to each existing day's adhan,
 *   preserves adhan, overwrites iqamah.
 * - Neither changed: no-op. Saves that touch only `name`/`notes`/etc. are cheap.
 *
 * If the tenant lacks lat/lng/timezone/method, range-change regen silently
 * skips — the admin still has the explicit "Regenerate now" button as an
 * escape hatch once the tenant is properly configured.
 */
export const autoRegeneratePrayerDays: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const startISO = data?.startDate as string | null | undefined
  const endISO = data?.endDate as string | null | undefined
  const rules = data?.iqamahRules as IqamahRulesShape | undefined
  if (!startISO || !endISO || !rules) return data

  const origStart = (originalDoc?.startDate as string | null | undefined) ?? null
  const origEnd = (originalDoc?.endDate as string | null | undefined) ?? null
  const origRules = originalDoc?.iqamahRules as IqamahRulesShape | undefined

  const rangeChanged = startISO !== origStart || endISO !== origEnd
  const rulesChanged = JSON.stringify(rules) !== JSON.stringify(origRules ?? null)

  if (!rangeChanged && !rulesChanged) return data

  if (rangeChanged) {
    const tenantId = extractId(data?.tenant ?? originalDoc?.tenant)
    if (!tenantId) return data

    try {
      const tenant = (await req.payload.findByID({
        collection: 'tenants',
        id: tenantId,
        depth: 0,
        overrideAccess: true,
      })) as {
        location?: { lat?: number; lng?: number; timezone?: string }
        prayerCalc?: { method?: AdhanMethod; asrMadhab?: AsrMadhab }
      }
      const lat = tenant.location?.lat
      const lng = tenant.location?.lng
      const tz = tenant.location?.timezone
      const method = tenant.prayerCalc?.method
      const madhab = tenant.prayerCalc?.asrMadhab ?? 'Standard'
      if (lat == null || lng == null || !tz || !method) return data

      data.days = generateDays({
        startDate: startISO,
        endDate: endISO,
        lat,
        lng,
        timezone: tz,
        method,
        madhab,
        rules,
      })
      return data
    } catch {
      return data
    }
  }

  // Rules changed only: re-apply iqamah to existing days, preserve adhan.
  const days = (data?.days as DayRow[] | undefined) ?? []
  if (days.length === 0) return data

  data.days = days.map((d) => {
    const next: DayRow = { ...d }
    for (const p of PRAYERS) {
      const adhan = (d[p] as { adhan?: string | null } | null | undefined)?.adhan ?? ''
      next[p] = { adhan, iqamah: applyIqamahRule(ruleFor(rules[p]), adhan) }
    }
    return next
  })

  return data
}
