import type { Endpoint, PayloadHandler } from 'payload'

import { generateDays, type IqamahRulesShape } from '@/lib/generateDays'
import type { AdhanMethod, AsrMadhab } from '@/lib/adhan'

const handler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json?.()) as { scheduleId?: string | number } | undefined
  const scheduleId = body?.scheduleId
  if (!scheduleId) return Response.json({ error: 'scheduleId required' }, { status: 400 })

  const schedule = (await payload.findByID({
    collection: 'prayer-schedules',
    id: scheduleId,
    depth: 1,
    overrideAccess: false,
    user,
  })) as Record<string, unknown>

  if (!schedule) return Response.json({ error: 'Schedule not found' }, { status: 404 })

  const tenantRel = schedule.tenant as { id?: string | number } | string | number
  const tenantId =
    typeof tenantRel === 'object' && tenantRel !== null ? tenantRel.id : tenantRel
  if (!tenantId) return Response.json({ error: 'Schedule has no tenant' }, { status: 400 })

  const tenant = (await payload.findByID({
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
  const timezone = tenant.location?.timezone
  const method = tenant.prayerCalc?.method
  const madhab = tenant.prayerCalc?.asrMadhab ?? 'Standard'

  if (lat == null || lng == null || !timezone || !method) {
    return Response.json(
      {
        error:
          'Tenant is missing required calculation config. Set lat/lng/timezone and prayerCalc.method before generating.',
      },
      { status: 400 },
    )
  }

  const startDate = schedule.startDate as string | null
  const endDate = schedule.endDate as string | null
  if (!startDate || !endDate) {
    return Response.json(
      { error: 'Schedule requires both startDate and endDate.' },
      { status: 400 },
    )
  }

  const rules = schedule.iqamahRules as IqamahRulesShape | undefined
  if (!rules) return Response.json({ error: 'iqamahRules missing' }, { status: 400 })

  const days = generateDays({
    startDate,
    endDate,
    lat,
    lng,
    timezone,
    method,
    madhab,
    rules,
  })

  await payload.update({
    collection: 'prayer-schedules',
    id: scheduleId,
    data: { days },
    overrideAccess: false,
    user,
  })

  return Response.json({ ok: true, dayCount: days.length })
}

export const generatePrayerTimesEndpoint: Endpoint = {
  path: '/generate-prayer-times',
  method: 'post',
  handler,
}
