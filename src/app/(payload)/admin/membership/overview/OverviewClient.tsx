'use client'

import type { Aggregates } from '@/lib/membership-aggregates'

type Props = {
  tenantName: string
  aggregates: Aggregates
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function StatCard({ eyebrow, value }: { eyebrow: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-border bg-white p-6 shadow-sh-sm">
      <div className="mb-2 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
        {eyebrow}
      </div>
      <div className="font-display text-[40px] font-medium leading-[1.05] text-fg1">{value}</div>
    </div>
  )
}

export default function OverviewClient({ tenantName, aggregates }: Props) {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10 md:px-10 md:py-12">
      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
        {tenantName} · Membership
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[40px] font-medium leading-[1.08] tracking-tight text-fg1 md:text-[48px]">
          Overview
        </h1>
      </div>

      <nav className="mb-10 flex flex-wrap gap-2">
        <a
          href="/admin/collections/membership-tiers"
          className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-4 py-[10px] font-body text-fs-sm font-semibold text-fg2 shadow-sh-sm transition-colors duration-base ease-out hover:bg-bg-alt"
        >
          Manage tiers
        </a>
        <a
          href="/admin/collections/members"
          className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-4 py-[10px] font-body text-fs-sm font-semibold text-fg2 shadow-sh-sm transition-colors duration-base ease-out hover:bg-bg-alt"
        >
          All members
        </a>
        <a
          href="/api/members/export.csv"
          className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-4 py-[10px] font-body text-fs-sm font-semibold text-fg2 shadow-sh-sm transition-colors duration-base ease-out hover:bg-bg-alt"
        >
          Download CSV
        </a>
      </nav>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard eyebrow="Active" value={String(aggregates.activeCount)} />
        <StatCard eyebrow="In grace" value={String(aggregates.graceCount)} />
        <StatCard eyebrow="Inactive" value={String(aggregates.inactiveCount)} />
        <StatCard eyebrow="MRR" value={formatDollars(aggregates.mrrCents)} />
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-fs-lg font-medium text-fg1">By tier</h2>
        <div className="overflow-hidden rounded-[var(--r-md)] border border-border bg-white shadow-sh-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-alt">
                <th className="px-4 py-3 text-left font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                  Tier
                </th>
                <th className="px-4 py-3 text-right font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                  Active
                </th>
                <th className="px-4 py-3 text-right font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                  In grace
                </th>
                <th className="px-4 py-3 text-right font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                  MRR
                </th>
              </tr>
            </thead>
            <tbody>
              {aggregates.byTier.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center font-body text-fs-sm text-fg3"
                  >
                    No members yet.
                  </td>
                </tr>
              ) : (
                aggregates.byTier.map((t) => (
                  <tr key={String(t.tierId)} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-body text-fs-base text-fg1">{t.tierName}</td>
                    <td className="px-4 py-3 text-right font-body text-fs-base text-fg2">
                      {t.activeCount}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-fs-base text-fg2">
                      {t.graceCount}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-fs-base text-fg2">
                      {formatDollars(t.mrrCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
