import { Context, Hono } from 'hono'
import { HomePage } from './components/home-page'
import { AppBindings, getCatalogSnapshot, syncCatalog } from './lib/catalog-service'
import { getAssetImageStorageKey, getAssetMediaUrl } from './lib/catalog'
import { getMessages, resolveLocale } from './lib/i18n'
import { renderer } from './renderer'

const app = new Hono<{ Bindings: AppBindings }>()

app.use(renderer)

app.get('/', async (c) => {
  const requestUrl = new URL(c.req.url)
  const locale = resolveLocale(requestUrl, c.req.header('accept-language'))
  const snapshot = await getCatalogSnapshot(c.env)
  const messages = getMessages(locale)

  return c.render(<HomePage locale={locale} requestUrl={requestUrl} snapshot={snapshot} />, {
    locale,
    title: messages.title,
  })
})

app.get('/api/assets', async (c) => {
  const snapshot = await getCatalogSnapshot(c.env)

  return c.json({
    ...snapshot,
    items: snapshot.items.map((item) => ({
      ...item,
      mediaUrl: getAssetMediaUrl(item.id),
    })),
  })
})

app.get('/media/:assetId', async (c) => {
  const storageKey = getAssetImageStorageKey(c.req.param('assetId'))

  if (c.env.R2) {
    const object = await c.env.R2.get(storageKey)

    if (object) {
      const headers = new Headers()

      object.writeHttpMetadata?.(headers)
      headers.set('cache-control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800')

      return new Response(object.body ?? null, {
        headers,
      })
    }
  }

  const snapshot = await getCatalogSnapshot(c.env)
  const asset = snapshot.items.find((item) => item.id === c.req.param('assetId'))

  if (!asset?.imageUrl) {
    return c.json(
      {
        error: 'Asset image not found',
      },
      404
    )
  }

  const upstream = await fetch(asset.imageUrl)

  if (!upstream.ok) {
    return c.json(
      {
        error: 'Image upstream request failed',
      },
      502
    )
  }

  const headers = new Headers(upstream.headers)

  headers.set('cache-control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800')
  headers.set('x-worth-image-origin', snapshot.meta.origin ?? snapshot.meta.source)

  if (c.env.R2) {
    await c.env.R2.put(storageKey, await upstream.clone().arrayBuffer(), {
      httpMetadata: {
        contentType: upstream.headers.get('content-type') ?? undefined,
      },
    })
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
})

const handleSyncRequest = async (c: Context<{ Bindings: AppBindings }>) => {
  try {
    c.header('cache-control', 'no-store')

    return c.json(await syncCatalog(c.env))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'

    c.header('cache-control', 'no-store')

    return c.json(
      {
        error: message,
      },
      message === 'Missing Notion configuration' ? 400 : 502
    )
  }
}

app.get('/api/admin/sync', handleSyncRequest)
app.post('/api/admin/sync', handleSyncRequest)

export default {
  fetch: app.fetch,
  request: app.request,
  scheduled(
    _controller: { cron: string; scheduledTime: number },
    env: AppBindings,
    ctx: {
      waitUntil(promise: Promise<unknown>): void
    }
  ) {
    if (!env.NOTION_API_TOKEN || !env.NOTION_DATA_SOURCE_ID) {
      return
    }

    ctx.waitUntil(syncCatalog(env).then(() => undefined))
  },
}
