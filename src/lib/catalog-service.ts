import {
  asCatalogSnapshot,
  CatalogSnapshot,
  cloneSnapshotAsCache,
  getAssetImageStorageKey,
  getCatalogCacheKey,
  getSampleCatalog,
  isSnapshotFresh,
} from './catalog'
import { syncNotionCatalog } from './notion'

export type KVNamespaceLike = {
  get(key: string, type?: 'json'): Promise<unknown>
  put(key: string, value: string): Promise<void>
}

export type R2ObjectLike = {
  body?: BodyInit | null
  writeHttpMetadata?(headers: Headers): void
}

export type R2BucketLike = {
  get(key: string): Promise<R2ObjectLike | null>
  put(
    key: string,
    value: BodyInit | null,
    options?: {
      httpMetadata?: {
        contentType?: string
      }
    }
  ): Promise<void>
}

export type AppBindings = {
  NOTION_API_TOKEN?: string
  NOTION_DATA_SOURCE_ID?: string
  CATALOG_STALE_MS?: string
  KV?: KVNamespaceLike
  R2?: R2BucketLike
}

const DEFAULT_STALE_MS = 1000 * 60 * 60 * 6

export async function getCatalogSnapshot(
  env: AppBindings | undefined,
  now = new Date()
): Promise<CatalogSnapshot> {
  const cachedSnapshot = env?.KV
    ? await readSnapshotFromCache(env.KV)
    : null
  const staleMs = getStaleMs(env)

  if (cachedSnapshot && isSnapshotFresh(cachedSnapshot, staleMs, now.getTime())) {
    return cloneSnapshotAsCache(cachedSnapshot)
  }

  if (hasNotionConfig(env)) {
    try {
      return await syncCatalog(env, now)
    } catch (error) {
      if (cachedSnapshot) {
        return cloneSnapshotAsCache(cachedSnapshot)
      }

      throw error
    }
  }

  if (cachedSnapshot) {
    return cloneSnapshotAsCache(cachedSnapshot)
  }

  return getSampleCatalog(now)
}

export async function syncCatalog(
  env: AppBindings | undefined,
  now = new Date()
): Promise<CatalogSnapshot> {
  if (!hasNotionConfig(env)) {
    throw new Error('Missing Notion configuration')
  }

  const snapshot = await syncNotionCatalog(
    {
      apiToken: env.NOTION_API_TOKEN!,
      dataSourceId: env.NOTION_DATA_SOURCE_ID!,
    },
    now
  )

  if (env.R2) {
    await Promise.all(
      snapshot.items.map(async (item) => {
        if (!item.imageUrl) {
          return
        }

        const response = await fetch(item.imageUrl)

        if (!response.ok) {
          return
        }

        await env.R2!.put(getAssetImageStorageKey(item.id), await response.arrayBuffer(), {
          httpMetadata: {
            contentType: response.headers.get('content-type') ?? undefined,
          },
        })
      })
    )
  }

  if (env.KV) {
    await env.KV.put(getCatalogCacheKey(), JSON.stringify(snapshot))
  }

  return snapshot
}

async function readSnapshotFromCache(cache: KVNamespaceLike): Promise<CatalogSnapshot | null> {
  const cached = await cache.get(getCatalogCacheKey(), 'json')

  return asCatalogSnapshot(cached)
}

function hasNotionConfig(env: AppBindings | undefined): env is AppBindings & {
  NOTION_API_TOKEN: string
  NOTION_DATA_SOURCE_ID: string
} {
  return Boolean(env?.NOTION_API_TOKEN && env?.NOTION_DATA_SOURCE_ID)
}

function getStaleMs(env: AppBindings | undefined) {
  const parsed = Number(env?.CATALOG_STALE_MS)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_STALE_MS
  }

  return parsed
}
