import { cookies } from 'next/headers'

import { PROGRAM_COOKIE, resolveProgramId, type ProgramRef } from './program-context'

/**
 * Server-side program resolution that keeps the picker "sticky" across
 * navigation. Precedence: an explicit `?program=` wins; otherwise fall back to
 * the last-selected program (persisted in a cookie by ProgramPicker); otherwise
 * the newest active program (via {@link resolveProgramId}).
 *
 * This lives in a `.server` module because it reads `next/headers` — keep it
 * out of `program-context.ts`, which is imported by client components.
 */
export async function selectedProgramId(
  requested: string | undefined,
  programs: ProgramRef[],
): Promise<string | number | null> {
  let req = requested
  if (!req) {
    const store = await cookies()
    // A stale "new" cookie shouldn't force create-mode as the default.
    const cookieVal = store.get(PROGRAM_COOKIE)?.value
    if (cookieVal && cookieVal !== 'new') req = cookieVal
  }
  return resolveProgramId(req, programs)
}
