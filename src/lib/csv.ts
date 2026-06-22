/**
 * RFC 4180 CSV cell escaping: wrap in double quotes (doubling any embedded
 * quotes) when the value contains a comma, quote, CR or LF; otherwise return
 * it unchanged. Shared by the attendance, form-submission, and member exports.
 */
export function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
