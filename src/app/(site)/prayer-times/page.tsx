import type { PrayerScheduleLike, PrayerTimePair } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { getActiveSchedule, getAllSchedules } from '@/lib/prayer-schedule'

export const metadata = {
  title: 'Prayer Times',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PRAYERS: Array<{ key: 'fajr' | 'zuhr' | 'asr' | 'maghrib' | 'isha'; name: string }> = [
  { key: 'fajr', name: 'Fajr' },
  { key: 'zuhr', name: 'Zuhr' },
  { key: 'asr', name: 'Asr' },
  { key: 'maghrib', name: 'Maghrib' },
  { key: 'isha', name: 'Isha' },
]

function pair(p: PrayerTimePair | null | undefined): { adhan: string; iqamah: string } {
  return {
    adhan: p?.adhan?.trim() || '—',
    iqamah: p?.iqamah?.trim() || '—',
  }
}

function formatStartDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function jummahList(s: PrayerScheduleLike): string[] {
  return (s.jummahTimes ?? [])
    .map((t) => (typeof t === 'string' ? t : t?.time))
    .filter((t): t is string => !!t && t.length > 0)
}

export default async function PrayerTimesPage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const [active, all] = await Promise.all([
    getActiveSchedule(tenant.id),
    getAllSchedules(tenant),
  ])

  const activeId = active?.id
  const baseline = all.find((s) => !s.startDate) ?? null
  const dated = all
    .filter((s) => !!s.startDate)
    .slice()
    // Ensure startDate desc (newest at top)
    .sort(
      (a, b) =>
        new Date(b.startDate!).getTime() - new Date(a.startDate!).getTime(),
    )

  const activeJummah = active ? jummahList(active) : []

  return (
    <section className="py-20">
      <div className="mx-auto max-w-page px-6">
        <header className="mb-12 max-w-[720px]">
          <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            Salah schedule
          </div>
          <h1 className="mb-4 font-display text-[52px] font-medium leading-[1.08] tracking-tight text-fg1">
            Prayer times
          </h1>
          <p className="m-0 text-[17px] leading-relaxed text-fg2">
            Iqamah (prayer start) times for the five daily prayers and Jummah,
            with the corresponding adhan (call to prayer) shown alongside. The
            schedule below is in effect today. Upcoming schedule changes are
            listed at the bottom of the page.
          </p>
        </header>

        {!active ? (
          <div className="rounded-[var(--r-md)] border border-border bg-white p-8 text-center text-fs-base text-fg3">
            Prayer times will be updated soon.
          </div>
        ) : (
          <div className="mb-10 rounded-[var(--r-md)] border border-border bg-white shadow-sh-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <div className="mb-1 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                  Currently in effect
                </div>
                <h2 className="font-display text-[28px] font-medium leading-tight text-fg1">
                  {active.name ?? 'Prayer schedule'}
                </h2>
                {active.startDate ? (
                  <div className="mt-1 text-fs-sm text-fg3">
                    Active since {formatStartDate(active.startDate)}
                  </div>
                ) : (
                  <div className="mt-1 text-fs-sm text-fg3">Baseline schedule</div>
                )}
              </div>
              {active.notes && (
                <div className="max-w-[360px] rounded-[6px] bg-secondary-soft px-4 py-2 font-body text-fs-sm text-fg1">
                  {active.notes}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-fs-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-alt">
                    <th className="px-6 py-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                      Prayer
                    </th>
                    <th className="px-6 py-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                      Iqamah
                    </th>
                    <th className="px-6 py-3 font-body text-[10.5px] font-medium uppercase tracking-caps text-fg3">
                      Adhan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PRAYERS.map(({ key, name }) => {
                    const p = pair(active[key])
                    return (
                      <tr key={key} className="border-b border-border last:border-b-0">
                        <td className="whitespace-nowrap px-6 py-4 font-body text-fs-base font-semibold text-fg1">
                          {name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-[20px] font-semibold text-fg1">
                          {p.iqamah}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-fs-sm text-fg3">
                          {p.adhan}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {activeJummah.length > 0 && (
              <div className="border-t border-border px-6 py-5">
                <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
                  Jummah (Friday prayer)
                </div>
                <div className="flex flex-wrap items-baseline gap-6">
                  {activeJummah.map((t, i) => (
                    <div key={`${t}-${i}`} className="flex items-baseline gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-[4px] bg-gold-100 font-body text-[11px] font-semibold text-navy-700">
                        {i + 1}
                      </span>
                      <span className="font-mono text-[18px] font-semibold text-fg1">
                        {t}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(dated.length > 0 || baseline) && (
          <div>
            <h2 className="mb-4 font-display text-[22px] font-medium text-fg1">
              Schedule changes
            </h2>
            <ol className="space-y-3">
              {dated.map((s) => {
                const isActive = s.id === activeId
                return (
                  <li
                    key={s.id}
                    className={[
                      'flex flex-wrap items-baseline justify-between gap-3 rounded-[var(--r-md)] border border-border bg-white px-5 py-4 shadow-sh-xs',
                      isActive ? 'ring-1 ring-brand/30' : '',
                    ].join(' ')}
                  >
                    <div>
                      <div className="font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                        Starts {formatStartDate(s.startDate)}
                        {isActive && (
                          <span className="ml-2 inline-flex items-center rounded-[4px] bg-brand px-[6px] py-[1px] font-body text-[10px] font-semibold uppercase tracking-caps text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="font-display text-[18px] font-medium text-fg1">
                        {s.name ?? 'Schedule'}
                      </div>
                      {s.notes && (
                        <div className="mt-1 text-fs-sm text-fg2">{s.notes}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-5 text-fs-sm">
                      {PRAYERS.map(({ key, name }) => {
                        const p = pair(s[key])
                        return (
                          <div key={key} className="flex flex-col gap-[2px]">
                            <span className="text-[10.5px] uppercase tracking-caps text-fg3">
                              {name}
                            </span>
                            <span className="font-mono text-fs-base font-semibold text-fg1">
                              {p.iqamah}
                            </span>
                            <span className="font-mono text-[11px] text-fg3">
                              Adhan {p.adhan}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </li>
                )
              })}

              {baseline && (
                <li
                  key={baseline.id}
                  className={[
                    'flex flex-wrap items-baseline justify-between gap-3 rounded-[var(--r-md)] border border-border bg-bg-alt px-5 py-4',
                    baseline.id === activeId ? 'ring-1 ring-brand/30' : '',
                  ].join(' ')}
                >
                  <div>
                    <div className="font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                      Baseline
                      {baseline.id === activeId && (
                        <span className="ml-2 inline-flex items-center rounded-[4px] bg-brand px-[6px] py-[1px] font-body text-[10px] font-semibold uppercase tracking-caps text-white">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="font-display text-[18px] font-medium text-fg1">
                      {baseline.name ?? 'Baseline schedule'}
                    </div>
                    <div className="mt-1 text-fs-sm text-fg2">
                      Shown when no dated schedule applies.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-5 text-fs-sm">
                    {PRAYERS.map(({ key, name }) => {
                      const p = pair(baseline[key])
                      return (
                        <div key={key} className="flex flex-col gap-[2px]">
                          <span className="text-[10.5px] uppercase tracking-caps text-fg3">
                            {name}
                          </span>
                          <span className="font-mono text-fs-base font-semibold text-fg1">
                            {p.iqamah}
                          </span>
                          <span className="font-mono text-[11px] text-fg3">
                            Adhan {p.adhan}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </li>
              )}
            </ol>
          </div>
        )}
      </div>
    </section>
  )
}
