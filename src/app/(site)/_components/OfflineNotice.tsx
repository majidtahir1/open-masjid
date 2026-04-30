export default function OfflineNotice({ tenantName }: { tenantName: string }) {
  return (
    <main
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: 48,
        maxWidth: 640,
        margin: '0 auto',
        color: '#1f2937',
      }}
    >
      <h1 style={{ fontSize: 24 }}>{tenantName} is currently offline</h1>
      <p>
        This site is temporarily unavailable. If you&apos;re an administrator, please sign in to the
        admin panel to restore service.
      </p>
    </main>
  )
}
