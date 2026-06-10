export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export type AuthzResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; error: string }

/** Gate the relay: only authenticated tenant admins may use the web chat. */
export function authorizeAnsari(user: { role?: string } | null): AuthzResult {
  if (!user) return { ok: false, status: 401, error: 'unauthenticated' }
  if (user.role !== 'admin') return { ok: false, status: 403, error: 'forbidden' }
  return { ok: true }
}

/**
 * Cap on messages replayed upstream per request. The browser resends history
 * as plain text (reasoning/tool state is lost), so long threads drift away
 * from the SOUL.md persona; a bounded window keeps it dominant.
 */
export const ANSARI_MAX_HISTORY_MESSAGES = 20

/**
 * Keep only the most recent `max` messages, then drop any leading assistant
 * messages so the window always opens with a user turn.
 */
export function trimChatHistory(messages: ChatMessage[], max: number): ChatMessage[] {
  let window = messages.slice(-max)
  while (window.length > 0 && window[0].role === 'assistant') {
    window = window.slice(1)
  }
  return window
}

export type HermesConfig = { baseUrl: string; apiKey: string }

/** Build the upstream request to a Hermes profile's OpenAI-compatible chat endpoint. */
export function buildHermesChatRequest(
  messages: ChatMessage[],
  cfg: HermesConfig,
): { url: string; init: RequestInit } {
  const base = cfg.baseUrl.replace(/\/+$/, '')
  return {
    url: `${base}/v1/chat/completions`,
    init: {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'hermes-agent',
        messages,
        stream: true,
      }),
    },
  }
}

/**
 * Parse one SSE line from /v1/chat/completions stream into an assistant text
 * delta. Returns the text fragment, or null for [DONE], comments, non-data
 * lines, and chunks without content (role-only chunks, tool-progress events).
 */
export function parseSseContentDelta(line: string): string | null {
  if (!line.startsWith('data:')) return null
  const payload = line.slice('data:'.length).trim()
  if (payload === '' || payload === '[DONE]') return null
  try {
    const json = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>
    }
    const content = json.choices?.[0]?.delta?.content
    return typeof content === 'string' && content.length > 0 ? content : null
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
