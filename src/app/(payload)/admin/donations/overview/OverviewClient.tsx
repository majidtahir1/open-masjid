'use client'

import { useState } from 'react'
import type { Aggregates, DonationRow } from '@/lib/donations-aggregates'

type Props = {
  tenantName: string
  stripeAccountId: string | null
  aggregates: Aggregates
  recent: DonationRow[]
}

const PAGE_SIZE = 25

function formatDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function StatusPill({ status }: { status: DonationRow['status'] }) {
  if (status === 'succeeded') {
    return (
      <span className="inline-flex items-center rounded-pill bg-success-soft px-3 py-1 font-body text-fs-xs font-semibold text-success">
        Succeeded
      </span>
    )
  }
  if (status === 'refunded') {
    return (
      <span className="inline-flex items-center rounded-pill bg-secondary-soft px-3 py-1 font-body text-fs-xs font-semibold text-secondary">
        Refunded
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-pill bg-bg-alt px-3 py-1 font-body text-fs-xs font-semibold text-fg2">
      Failed
    </span>
  )
}

function StatCard({ eyebrow, value }: { eyebrow: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-border bg-white p-6 shadow-sh-sm">
      <div className="mb-2 font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
        {eyebrow}
      </div>
      <div className="font-display text-[40px] font-medium leading-[1.05] text-fg1">
        {value}
      </div>
    </div>
  )
}

export default function OverviewClient({
  tenantName,
  stripeAccountId,
  aggregates,
  recent,
}: Props) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const visible = recent.slice(0, visibleCount)
  const canShowMore = visibleCount < recent.length
  const stripeDashboardUrl = stripeAccountId
    ? `https://dashboard.stripe.com/${stripeAccountId}`
    : null

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10 md:px-10 md:py-12">
      <div className="mb-3 font-body text-fs-xs font-semibold uppercase tracking-caps text-brand">
        {tenantName} · Donations
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[40px] font-medium leading-[1.08] tracking-tight text-fg1 md:text-[48px]">
          Overview
        </h1>
      </div>

      <nav className="mb-10 flex flex-wrap gap-2">
        <a
          href="/admin/collections/donation-funds"
          className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-4 py-[10px] font-body text-fs-sm font-semibold text-fg2 shadow-sh-sm transition-colors duration-base ease-out hover:bg-bg-alt"
        >
          Manage funds
        </a>
        <a
          href="/admin/donations/connect"
          className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-4 py-[10px] font-body text-fs-sm font-semibold text-fg2 shadow-sh-sm transition-colors duration-base ease-out hover:bg-bg-alt"
        >
          Stripe connection
        </a>
        <a
          href="/admin/collections/donations"
          className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-4 py-[10px] font-body text-fs-sm font-semibold text-fg2 shadow-sh-sm transition-colors duration-base ease-out hover:bg-bg-alt"
        >
          All donations
        </a>
        {stripeDashboardUrl ? (
          <a
            href={stripeDashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-border bg-white px-4 py-[10px] font-body text-fs-sm font-semibold text-fg2 shadow-sh-sm transition-colors duration-base ease-out hover:bg-bg-alt"
          >
            Open Stripe dashboard
            <span aria-hidden>↗</span>
          </a>
        ) : null}
        <a
          href="/api/donations/export.csv"
          className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-4 py-[10px] font-body text-fs-sm font-semibold text-fg2 shadow-sh-sm transition-colors duration-base ease-out hover:bg-bg-alt"
        >
          Download CSV
        </a>
      </nav>

      <section className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard eyebrow="This month" value={formatDollars(aggregates.thisMonthCents)} />
        <StatCard eyebrow="Year to date" value={formatDollars(aggregates.ytdCents)} />
        <StatCard eyebrow="Donations (YTD)" value={String(aggregates.count)} />
        <StatCard eyebrow="Average gift" value={formatDollars(aggregates.avgCents)} />
        <StatCard
          eyebrow="Active monthly donors"
          value={String(aggregates.monthlyDonorCount)}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-fs-lg font-medium text-fg1">By fund</h2>
        <div className="overflow-hidden rounded-[var(--r-md)] border border-border bg-white shadow-sh-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border bg-bg-alt">
                <th className="px-4 py-3 text-left font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                  Fund
                </th>
                <th className="px-4 py-3 text-right font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                  This-month count
                </th>
                <th className="px-4 py-3 text-right font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                  This-month $
                </th>
                <th className="px-4 py-3 text-right font-body text-fs-xs font-semibold uppercase tracking-caps text-fg3">
                  YTD $
                </th>
              </tr>
            </thead>
            <tbody>
              {aggregates.byFund.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-center font-body text-fs-sm text-fg3"
                  >
                    No donations yet.
                  </td>
                </tr>
              ) : (
                aggregates.byFund.map((f) => (
                  <tr key={String(f.fundId)} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-body text-fs-base text-fg1">{f.fundName}</td>
                    <td className="px-4 py-3 text-right font-body text-fs-base text-fg2">
                      {f.thisMonthCount}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-fs-base text-fg2">
                      {formatDollars(f.thisMonthCents)}
                    </td>
                    <td className="px-4 py-3 text-right font-body text-fs-base text-fg2">
                      {formatDollars(f.ytdCents)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-display text-fs-lg font-medium text-fg1">Recent activity</h2>
        <div className="overflow-hidden rounded-[var(--r-md)] border border-border bg-white shadow-sh-sm">
          {visible.length === 0 ? (
            <div className="px-4 py-6 text-center font-body text-fs-sm text-fg3">
              No recent donations.
            </div>
          ) : (
            <ul>
              {visible.map((row) => {
                const dashUrl = `https://dashboard.stripe.com/${row.stripeAccountId}/payments/${row.stripePaymentIntentId}`
                return (
                  <li
                    key={String(row.id)}
                    className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <span className="w-28 font-body text-fs-sm text-fg3">
                      {formatDate(row.createdAt)}
                    </span>
                    <span className="min-w-[120px] flex-1 font-body text-fs-base text-fg1">
                      {row.fund.name}
                    </span>
                    <span className="w-24 text-right font-body text-fs-base font-semibold text-fg1">
                      {formatDollars(row.amount)}
                    </span>
                    <span className="w-20 font-body text-fs-xs text-fg3">
                      {row.frequency === 'monthly' ? 'Monthly' : 'One-time'}
                    </span>
                    <span className="w-28">
                      <StatusPill status={row.status} />
                    </span>
                    <a
                      href={dashUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-fs-sm text-secondary underline-offset-2 hover:text-secondary-hover hover:underline"
                    >
                      View in Stripe →
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        {canShowMore ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="inline-flex items-center rounded-[var(--r-md)] border border-border bg-white px-5 py-[10px] font-body text-fs-sm font-semibold text-fg2 hover:bg-bg-alt"
            >
              Show more
            </button>
          </div>
        ) : null}
      </section>
    </main>
  )
}
