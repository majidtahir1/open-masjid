import type { PrayerScheduleLike, PrayerTimePair } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { findDayRow, getActiveSchedule } from '@/lib/prayer-schedule'

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

function jummahList(s: PrayerScheduleLike): string[] {
  return (s.jummahTimes ?? [])
    .map((t) => (typeof t === 'string' ? t : t?.time))
    .filter((t): t is string => !!t && t.length > 0)
}

export default async function PrayerTimesPage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const active = await getActiveSchedule(tenant.id)
  const today = findDayRow(active)

  // Flatten today's day row into the same shape the render helpers expect.
  const flat: PrayerScheduleLike | null =
    active && today
      ? {
          id: active.id,
          name: active.name,
          startDate: active.startDate,
          fajr: today.fajr,
          zuhr: today.zuhr,
          asr: today.asr,
          maghrib: today.maghrib,
          isha: today.isha,
          jummahTimes: active.jummahTimes,
          notes: active.notes,
        }
      : null

  const activeJummah = flat ? jummahList(flat) : []

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
            with the corresponding adhan (call to prayer) shown alongside.
          </p>
        </header>

        {!flat ? (
          <div className="rounded-[var(--r-md)] border border-border bg-white p-8 text-center text-fs-base text-fg3">
            Prayer times will be updated soon.
          </div>
        ) : (
          <div className="mb-10 rounded-[var(--r-md)] border border-border bg-white shadow-sh-xs">
            {flat.notes && (
              <div className="border-b border-border px-6 py-4 font-body text-fs-sm text-fg1">
                {flat.notes}
              </div>
            )}

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
                    const p = pair(flat[key])
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

      </div>
    </section>
  )
}
