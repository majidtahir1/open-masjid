/** Normalize a phone to comparable digits: strip non-digits, keep the last 10
 *  so "(214) 555-0123" and "2145550123" match. Shared by the check-in kiosk
 *  (match time) and student materialization (store time) so the two never drift. */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}
