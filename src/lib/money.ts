/**
 * Format an integer cent amount (Stripe convention) as a localized currency
 * string. `currency` is case-insensitive and defaults to USD. Pass
 * `{ whole: true }` to drop the fractional part (rounded to whole units).
 *
 * Centralizes the `Intl.NumberFormat({ style: 'currency' }).format(cents / 100)`
 * pattern that was duplicated across the donations, membership, tuition, and
 * submission UIs.
 */
export function formatCents(
  cents: number,
  currency: string | null | undefined = 'usd',
  opts: { whole?: boolean } = {},
): string {
  const value = cents / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'usd').toUpperCase(),
    ...(opts.whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(opts.whole ? Math.round(value) : value)
}
