import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    reactCompiler: false,
  },
  // Emit a self-contained server at `.next/standalone/server.js` for the
  // production Docker image — keeps the final layer tiny (~150 MB) and skips
  // the need to ship node_modules at runtime.
  output: 'standalone',
}

export default withPayload(nextConfig)
