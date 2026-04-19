export const metadata = {
  title: 'OpenMasjid — the platform for masajid',
  description:
    'OpenMasjid is a self-hosted, open-source platform for masajid. Coming soon.',
}

export default function MarketingPage() {
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto flex min-h-screen max-w-page flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
          OpenMasjid
        </div>
        <h1 className="mb-6 max-w-[20ch] font-display text-[64px] font-medium leading-[1.05] tracking-tight text-fg1">
          The platform for <em className="text-brand">masajid</em>.
        </h1>
        <p className="mb-10 max-w-[52ch] text-[18px] leading-relaxed text-fg2">
          The most modern masjid digital management system that just works.  Built to help masjid volunteers run a modern
          masjid's digital presence without needing a developer on call.
        </p>
        <p className="font-body text-fs-sm font-semibold uppercase tracking-caps text-fg3">
          Coming soon
        </p>
      </div>
    </main>
  )
}
