import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    reactCompiler: false,
  },
  // Keep server-only Payload code out of the client/edge bundle. Without this
  // Next.js tries to bundle transitive Node-only deps like `busboy` from the
  // `instrumentation.ts` module, which blows up on missing `stream`.
  serverExternalPackages: ['payload', '@payloadcms/db-postgres', 'busboy', 'sharp'],
}

export default withPayload(nextConfig)
