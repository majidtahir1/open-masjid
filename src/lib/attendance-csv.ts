const idOf = (v: unknown): string | number =>
  typeof v === 'object' && v !== null && 'id' in v ? (v as { id: string | number }).id : (v as string | number)
const day = (d: unknown) => String(d ?? '').slice(0, 10)

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface CsvStudent { id: string | number; name: string }
export interface CsvSession { id: string | number; date: string }
export interface CsvRecord { student: unknown; session: unknown; status: string }

/** Student × session attendance matrix as CSV. Columns are session dates (ascending). */
export function buildAttendanceCsv(students: CsvStudent[], sessions: CsvSession[], records: CsvRecord[]): string {
  const cols = [...sessions].sort((a, b) => (day(a.date) < day(b.date) ? -1 : 1))
  const header = ['Student', ...cols.map((s) => day(s.date))].map(csvCell).join(',')
  // lookup: `${studentId}|${sessionId}` → status
  const map = new Map<string, string>()
  for (const r of records) map.set(`${idOf(r.student)}|${idOf(r.session)}`, r.status)
  const rows = students.map((st) =>
    [csvCell(st.name), ...cols.map((s) => csvCell(map.get(`${st.id}|${s.id}`) ?? ''))].join(','),
  )
  return [header, ...rows].join('\n')
}
