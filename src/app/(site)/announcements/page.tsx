import AnnouncementsList from '@/components/AnnouncementsList'
import type { AnnouncementLike } from '@/components/types'
import { getCurrentTenant } from '@/lib/tenant-server'
import { fetchAnnouncements } from '@/lib/data'

export const metadata = {
  title: 'Announcements',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AnnouncementsPage() {
  const tenant = await getCurrentTenant()
  if (!tenant) return null

  const announcements = (await fetchAnnouncements(tenant)) as AnnouncementLike[]

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[880px] px-6">
        <header className="mb-12 max-w-[720px]">
          <div className="mb-4 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
            Community updates
          </div>
          <h1 className="mb-4 font-display text-[52px] font-medium leading-[1.08] tracking-tight text-fg1">
            Announcements
          </h1>
          <p className="m-0 text-[17px] leading-relaxed text-fg2">
            Closures, schedule changes, and reminders from{' '}
            {tenant.name ?? 'the masjid'}. Newest first.
          </p>
        </header>

        <AnnouncementsList announcements={announcements} />
      </div>
    </section>
  )
}
