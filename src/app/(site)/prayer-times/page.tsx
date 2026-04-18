import type { PrayerTimesLike } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchUpcomingPrayerTimes } from '@/lib/data'

export const metadata = {
  title: 'Prayer Times',
}

type PrayerRow = PrayerTimesLike & { id?: string | number }

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function pair(adhan?: string | null, iqamah?: string | null): string {
  const a = adhan?.trim() || '—'
  const i = iqamah?.trim() || '—'
  return `${a} / ${i}`
}

export default async function PrayerTimesPage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const rows = (await fetchUpcomingPrayerTimes(tenant, 30)) as PrayerRow[]
  const today = rows.find((r) => isToday(r.date))
  const jummah = (today?.jummahTimes ?? [])
    .map((t) => (typeof t === 'string' ? t : t?.time))
    .filter((t): t is string => !!t)

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
            Adhan and iqamah times for the next 30 days. Jummah schedule is
            listed below. Times may shift by a minute or two seasonally.
          </p>
        </header>

        {jummah.length > 0 && (
          <div className="mb-10 rounded-[var(--r-md)] border border-border bg-white p-6 shadow-sh-xs">
            <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
              Jummah (Friday prayer)
            </div>
            <div className="flex flex-wrap items-baseline gap-6">
              {jummah.map((t, i) => (
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

        {rows.length === 0 ? (
          <div className="rounded-[var(--r-md)] border border-border bg-white p-8 text-center text-fs-base text-fg3">
            Prayer times will be updated soon.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--r-md)] border border-border bg-white shadow-sh-xs">
            <table className="w-full border-collapse text-left text-fs-sm">
              <thead>
                <tr className="border-b border-border bg-bg-alt">
                  <th className="px-5 py-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                    Date
                  </th>
                  <th className="px-5 py-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                    Fajr
                  </th>
                  <th className="px-5 py-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                    Zuhr
                  </th>
                  <th className="px-5 py-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                    Asr
                  </th>
                  <th className="px-5 py-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                    Maghrib
                  </th>
                  <th className="px-5 py-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                    Isha
                  </th>
                </tr>
                <tr className="border-b border-border bg-bg-alt/60 text-[10.5px] uppercase tracking-caps text-fg3">
                  <th className="px-5 py-2 font-normal"></th>
                  <th className="px-5 py-2 font-normal">Adhan / Iqamah</th>
                  <th className="px-5 py-2 font-normal">Adhan / Iqamah</th>
                  <th className="px-5 py-2 font-normal">Adhan / Iqamah</th>
                  <th className="px-5 py-2 font-normal">Adhan / Iqamah</th>
                  <th className="px-5 py-2 font-normal">Adhan / Iqamah</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const todayRow = isToday(row.date)
                  return (
                    <tr
                      key={row.id ?? row.date ?? Math.random()}
                      className={[
                        'border-b border-border last:border-b-0',
                        todayRow ? 'bg-secondary-soft' : '',
                      ].join(' ')}
                    >
                      <td className="whitespace-nowrap px-5 py-3 font-body text-fs-sm font-semibold text-fg1">
                        {formatDate(row.date)}
                        {todayRow && (
                          <span className="ml-2 inline-flex items-center rounded-[4px] bg-brand px-[6px] py-[1px] font-body text-[10px] font-semibold uppercase tracking-caps text-white">
                            Today
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-fs-sm text-fg1">
                        {pair(row.fajrAdhan, row.fajrIqamah)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-fs-sm text-fg1">
                        {pair(row.zuhrAdhan, row.zuhrIqamah)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-fs-sm text-fg1">
                        {pair(row.asrAdhan, row.asrIqamah)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-fs-sm text-fg1">
                        {pair(row.maghribAdhan, row.maghribIqamah)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-fs-sm text-fg1">
                        {pair(row.ishaAdhan, row.ishaIqamah)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
