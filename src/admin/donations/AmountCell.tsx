import type { DefaultServerCellComponentProps } from 'payload'

/**
 * List-view cell for `donations.amount`. The column stores cents (Stripe
 * convention) — render it as a human-readable currency string.
 */
export default function AmountCell({ cellData, rowData }: DefaultServerCellComponentProps) {
  const cents = typeof cellData === 'number' ? cellData : Number(cellData ?? 0)
  if (!Number.isFinite(cents)) return <span>—</span>
  const currency =
    typeof (rowData as { currency?: unknown })?.currency === 'string'
      ? ((rowData as { currency: string }).currency).toUpperCase()
      : 'USD'
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
  return <span>{formatted}</span>
}
