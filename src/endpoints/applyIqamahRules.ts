import type { Endpoint, PayloadHandler } from 'payload'

import { applyIqamahRule } from '@/lib/iqamah'
import { ruleFor, type IqamahRulesShape } from '@/lib/generateDays'

type DayShape = Record<
  'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha',
  { adhan?: string | null; iqamah?: string | null }
> & { date: string; id?: string }

const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const

const handler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json?.()) as { scheduleId?: string | number } | undefined
  const scheduleId = body?.scheduleId
  if (!scheduleId) return Response.json({ error: 'scheduleId required' }, { status: 400 })

  const schedule = (await payload.findByID({
    collection: 'prayer-schedules',
    id: scheduleId,
    depth: 0,
    overrideAccess: false,
    user,
  })) as unknown as Record<string, unknown>

  const rules = schedule.iqamahRules as IqamahRulesShape | undefined
  const days = (schedule.days as DayShape[] | undefined) ?? []
  if (!rules) return Response.json({ error: 'iqamahRules missing' }, { status: 400 })
  if (days.length === 0) {
    return Response.json(
      { error: 'No days to update. Run "Generate times" first.' },
      { status: 400 },
    )
  }

  const updatedDays = days.map((d) => {
    const next: DayShape = { ...d } // preserves `date` and `sunrise`
    for (const p of PRAYERS) {
      const adhan = d[p]?.adhan ?? ''
      next[p] = { adhan, iqamah: applyIqamahRule(ruleFor(rules[p]), adhan) }
    }
    return next
  })

  await payload.update({
    collection: 'prayer-schedules',
    id: scheduleId,
    data: { days: updatedDays },
    overrideAccess: false,
    user,
  })

  return Response.json({ ok: true, dayCount: updatedDays.length })
}

export const applyIqamahRulesEndpoint: Endpoint = {
  path: '/apply-iqamah-rules',
  method: 'post',
  handler,
}
