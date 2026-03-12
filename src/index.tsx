import { Hono } from 'hono'
import { HomePage } from './components/home-page'
import { AppBindings, getCatalogSnapshot, syncCatalog } from './lib/catalog-service'
import { getAssetMediaUrl } from './lib/catalog'
import { renderer } from './renderer'

const app = new Hono<{ Bindings: AppBindings }>()

app.use(renderer)

app.get('/', async (c) => {
  return c.render(<HomePage snapshot={await getCatalogSnapshot(c.env)} />)
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

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  })
})

app.post('/api/admin/sync', async (c) => {
  const authorization = c.req.header('authorization')
  const adminToken = c.env?.ADMIN_TOKEN

  if (!adminToken || authorization !== `Bearer ${adminToken}`) {
    return c.json(
      {
        error: 'Unauthorized',
      },
      401
    )
  }

  return c.json(await syncCatalog(c.env))
})

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
