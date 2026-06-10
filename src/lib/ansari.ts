export type AuthzResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string }

/** Gate the relay: only authenticated tenant admins may use the web chat. */
export function authorizeAnsari(user: { role?: string } | null): AuthzResult {
  if (!user) return { ok: false, status: 401, error: 'unauthenticated' }
  if (user.role !== 'admin') return { ok: false, status: 403, error: 'forbidden' }
  return { ok: true }
}

export type HermesConfig = { baseUrl: string; apiKey: string }

/**
 * Build the upstream request to a Hermes profile's OpenAI-style Responses API.
 * Hermes holds conversation state server-side (reasoning, tool calls); each
 * turn sends only the new user message plus the previous response id to chain.
 */
export function buildHermesResponsesRequest(
  message: string,
  previousResponseId: string | null,
  cfg: HermesConfig,
): { url: string; init: RequestInit } {
  const base = cfg.baseUrl.replace(/\/+$/, '')
  return {
    url: `${base}/v1/responses`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: message,
        stream: true,
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
      }),
    },
  }
}

export type ResponsesSseEvent =
  | { kind: 'delta'; text: string }
  | { kind: 'completed'; responseId: string }

/**
 * Parse one SSE line from a /v1/responses stream. Returns a text delta, the
 * completed event carrying the response id to chain the next turn, or null
 * for everything else ([DONE], comments, event-name lines, lifecycle events).
 */
export function parseResponsesSseEvent(line: string): ResponsesSseEvent | null {
  if (!line.startsWith('data:')) return null
  const payload = line.slice('data:'.length).trim()
  if (payload === '' || payload === '[DONE]') return null
  try {
    const json = JSON.parse(payload) as {
      type?: string
      delta?: string
      response?: { id?: string }
    }
    if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') {
      return { kind: 'delta', text: json.delta }
    }
    if (json.type === 'response.completed' && typeof json.response?.id === 'string') {
      return { kind: 'completed', responseId: json.response.id }
    }
    return null
  } catch {
    return null
  }
}

/** Read Hermes config from env; throws a clear error if unset (POC: single endpoint). */
export function getHermesConfig(): HermesConfig {
  const baseUrl = process.env.HERMES_API_BASE_URL
  const apiKey = process.env.HERMES_API_KEY
  if (!baseUrl || !apiKey) {
    throw new Error('HERMES_API_BASE_URL and HERMES_API_KEY must be set')
  }
  return { baseUrl, apiKey }
}
