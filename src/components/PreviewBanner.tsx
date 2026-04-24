/**
 * Small amber banner rendered at the top of a page when the viewer is in
 * preview/draft mode. Makes it obvious the admin is looking at unpublished
 * content — not what the public sees.
 */
export default function PreviewBanner() {
  return (
    <div
      role="status"
      style={{
        background: '#fef3c7',
        borderBottom: '2px solid #d97706',
        color: '#78350f',
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      🛠 Preview mode — showing draft content. Public visitors see only the last published version.
    </div>
  )
}
