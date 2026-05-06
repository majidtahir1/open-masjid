/**
 * PublicFormProgress — shows "Step N of M" label + progress bar.
 * Artboard: 5.3 public-multi.
 */

interface Props {
  current: number
  total: number
}

export function PublicFormProgress({ current, total }: Props) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="om-pf-progress">
      <div className="om-pf-progress-meta">
        Step {current} of {total}
      </div>
      <div className="om-pf-progress-bar">
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
