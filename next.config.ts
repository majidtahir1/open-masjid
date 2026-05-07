import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  reactCompiler: false,
  // Acknowledge Turbopack so Next stops warning that Webpack is configured
  // (via withPayload) without a Turbopack counterpart. Empty config = use
  // Turbopack defaults; Payload runs fine under them.
  turbopack: {},
  // Emit a self-contained server at `.next/standalone/server.js` for the
  // production Docker image — keeps the final layer tiny (~150 MB) and skips
  // the need to ship node_modules at runtime.
  output: 'standalone',
}

export default withPayload(nextConfig)
