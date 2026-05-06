interface PayloadLike {
  count: (args: {
    collection: string
    where?: unknown
  }) => Promise<{ totalDocs: number }>
  find: (args: {
    collection: string
    where?: unknown
    limit?: number
    depth?: number
    sort?: string | string[]
    overrideAccess?: boolean
    draft?: boolean
  }) => Promise<{ docs: unknown[] }>
  findByID: (args: {
    collection: string
    id: string | number
    overrideAccess?: boolean
  }) => Promise<unknown>
}

let payloadClientPromise: Promise<PayloadLike | null> | null = null

/**
 * Lazily load Payload and the generated config so public-site routes do not
 * pull the entire admin/config graph into the initial dev compile path.
 */
export async function getPayloadClient(): Promise<PayloadLike | null> {
  if (!payloadClientPromise) {
    payloadClientPromise = (async () => {
      try {
        const [{ getPayload }, { default: config }] = await Promise.all([
          import('payload'),
          import('@payload-config'),
        ])
        return (await getPayload({ config })) as unknown as PayloadLike
      } catch {
        return null
      }
    })()
  }

  return payloadClientPromise
}
