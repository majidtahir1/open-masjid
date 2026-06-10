import { NextResponse } from 'next/server'
import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { authorizeAnsari, buildHermesResponsesRequest, getHermesConfig } from '@/lib/ansari'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = { message?: string; previousResponseId?: string | null }

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })

  const authz = authorizeAnsari(user as { role?: string } | null)
  if (!authz.ok) {
    return NextResponse.json({ error: authz.error }, { status: authz.status })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message === '') {
    return NextResponse.json({ error: 'message-required' }, { status: 400 })
  }
  const previousResponseId =
    typeof body.previousResponseId === 'string' && body.previousResponseId !== ''
      ? body.previousResponseId
      : null

  let cfg
  try {
    cfg = getHermesConfig()
  } catch {
    return NextResponse.json({ error: 'ansari-not-configured' }, { status: 503 })
  }

  const { url, init } = buildHermesResponsesRequest(message, previousResponseId, cfg)

  let upstream: Response
  try {
    upstream = await fetch(url, init)
  } catch {
    return NextResponse.json({ error: 'ansari-unreachable' }, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'ansari-error' }, { status: 502 })
  }

  // Pipe Hermes' SSE straight through to the browser.
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Prevent a front proxy (Caddy/Nginx) from buffering the stream.
      'X-Accel-Buffering': 'no',
    },
  })
}
