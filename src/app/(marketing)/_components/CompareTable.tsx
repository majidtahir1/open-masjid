export type CompareRow = { label: string; left: string; right: string }

export function CompareTable({
  leftLabel,
  rightLabel = 'OpenMasjid',
  rows,
}: {
  leftLabel: string
  rightLabel?: string
  rows: CompareRow[]
}) {
  return (
    <div className="om-compare-table">
      <div className="om-compare-row is-head">
        <span />
        <span>{leftLabel}</span>
        <span className="is-us">{rightLabel}</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="om-compare-row">
          <span className="om-compare-label">{r.label}</span>
          <span className="om-compare-them">{r.left}</span>
          <span className="om-compare-us">{r.right}</span>
        </div>
      ))}
    </div>
  )
}
