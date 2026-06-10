/**
 * Client-side submission stats for the Forms list view, with a per-form
 * promise cache so the two cells on each row share the same request.
 * Cache lives for the SPA session; a full page refresh re-fetches.
 */

export interface FormSubmissionStats {
  total: number
  lastAt: string | null
}

interface ListResponse {
  totalDocs?: number
  docs?: Array<{ submittedAt?: string | null }>
}

const cache = new Map<string, Promise<FormSubmissionStats>>()

export function fetchSubmissionStats(formId: string | number): Promise<FormSubmissionStats> {
  const key = String(formId)
  const hit = cache.get(key)
  if (hit) return hit

  const promise = (async (): Promise<FormSubmissionStats> => {
    const base = `/api/form-submissions?where[form][equals]=${encodeURIComponent(key)}&depth=0`
    const latestRes = await fetch(`${base}&limit=1&sort=-submittedAt`, { credentials: 'include' })
    if (!latestRes.ok) throw new Error('Failed to load submission stats')
    const latest = (await latestRes.json()) as ListResponse
    return {
      total: latest.totalDocs ?? 0,
      lastAt: latest.docs?.[0]?.submittedAt ?? null,
    }
  })()

  cache.set(key, promise)
  promise.catch(() => cache.delete(key))
  return promise
}
