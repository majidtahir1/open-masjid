'use client'

import React from 'react'

/**
 * Webhooks — v1 shell.
 * Full functionality (adding webhook endpoints, secret signing, retries)
 * is planned for a future release.
 */
export default function Webhooks() {
  return (
    <div className="settings-card">
      <div className="settings-shell">
        <h3 className="settings-shell__heading">Webhooks</h3>
        <p className="settings-shell__body">
          Coming soon. We&apos;ll let you POST submissions to a URL of your choice.
        </p>
        <button type="button" className="settings-btn settings-btn--secondary" disabled>
          Notify me
        </button>
      </div>
    </div>
  )
}
