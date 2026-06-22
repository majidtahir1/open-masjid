/**
 * Pure CSV formatter for the members export route.
 *
 * Columns (in order):
 *   name, email, phone, tier, status, stripeSubscriptionStatus,
 *   joinedAt, currentPeriodEnd, canceledAt, stripeCustomerId, stripeSubscriptionId
 *
 * The output starts with a UTF-8 BOM (﻿) so Excel opens it correctly.
 */

import { csvCell } from '@/lib/csv'

export interface MemberExportRow {
  name: string | null | undefined
  email: string | null | undefined
  phone: string | null | undefined
  /** Resolved tier name string — caller must populate (not the raw ID). */
  tierName: string | null | undefined
  status: string | null | undefined
  stripeSubscriptionStatus: string | null | undefined
  joinedAt: string | null | undefined
  currentPeriodEnd: string | null | undefined
  canceledAt: string | null | undefined
  stripeCustomerId: string | null | undefined
  stripeSubscriptionId: string | null | undefined
}

const COLUMNS = [
  'name',
  'email',
  'phone',
  'tier',
  'status',
  'stripeSubscriptionStatus',
  'joinedAt',
  'currentPeriodEnd',
  'canceledAt',
  'stripeCustomerId',
  'stripeSubscriptionId',
] as const

/**
 * Format an array of member rows as a UTF-8 BOM-prefixed CSV string.
 * Empty / null / undefined values are rendered as empty strings.
 * Date values should be pre-formatted (ISO strings) by the caller.
 */
export function formatMembersCsv(rows: MemberExportRow[]): string {
  const UTF8_BOM = '﻿'
  const header = COLUMNS.join(',')
  const lines: string[] = [header]

  for (const row of rows) {
    const cells = [
      row.name ?? '',
      row.email ?? '',
      row.phone ?? '',
      row.tierName ?? '',
      row.status ?? '',
      row.stripeSubscriptionStatus ?? '',
      row.joinedAt ?? '',
      row.currentPeriodEnd ?? '',
      row.canceledAt ?? '',
      row.stripeCustomerId ?? '',
      row.stripeSubscriptionId ?? '',
    ].map(csvCell)
    lines.push(cells.join(','))
  }

  return UTF8_BOM + lines.join('\n') + '\n'
}
