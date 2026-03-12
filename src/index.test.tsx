import { afterEach, describe, expect, test } from 'bun:test'

import app from './index'

class MemoryKV {
  private store = new Map<string, string>()

  async get(key: string, type?: 'json') {
    const value = this.store.get(key)

    if (!value) {
      return null
    }

    if (type === 'json') {
      return JSON.parse(value)
    }

    return value
  }

  async put(key: string, value: string) {
    this.store.set(key, value)
  }
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('worth worker', () => {
  test('serves a catalog API with computed daily costs', async () => {
    const response = await app.request('http://local.test/api/assets')

    expect(response.status).toBe(200)

    const payload = await response.json()

    expect(payload.meta.source).toBe('sample')
    expect(payload.summary.totalAssets).toBeGreaterThan(0)
    expect(payload.summary.portfolioDailyCost).toBeGreaterThan(0)
    expect(payload.items[0].name).toBeTruthy()
    expect(payload.items[0].dailyCost).toBeGreaterThan(0)
    expect(payload.items[0].imageUrl).toBeTruthy()
    expect(payload.items[0].mediaUrl).toContain('/media/')
  })

  test('renders the dashboard page with asset and summary content', async () => {
    const response = await app.request('http://local.test/')

    expect(response.status).toBe(200)

    const html = await response.text()

    expect(html).toContain('Worth Ledger')
    expect(html).toContain('Portfolio Daily Cost')
    expect(html).toContain('MacBook Pro')
    expect(html).toContain('/media/macbook-pro-m3-max')
  })

  test('rejects manual sync requests without an admin token', async () => {
    const response = await app.request('http://local.test/api/admin/sync', {
      method: 'POST',
    })

    expect(response.status).toBe(401)
  })

  test('prefers a fresh cached snapshot when KV data exists', async () => {
    const cache = new MemoryKV()

    await cache.put(
      'worth:catalog',
      JSON.stringify({
        items: [
          {
            id: 'cached-camera',
            name: 'Cached Camera',
            category: 'Electronics',
            purchasePrice: 1400,
            currentPrice: 980,
            purchaseDate: '2024-06-01',
            status: 'active',
            imageUrl: 'https://example.com/camera.jpg',
            notes: 'Loaded from KV.',
            daysOwned: 200,
            dailyCost: 7,
            priceDelta: -420,
          },
        ],
        summary: {
          totalAssets: 1,
          activeAssets: 1,
          totalPurchaseValue: 1400,
          totalCurrentValue: 980,
          portfolioDailyCost: 7,
        },
        meta: {
          source: 'cache',
          generatedAt: '2026-03-12T00:00:00.000Z',
        },
      })
    )

    const response = await app.request(
      'http://local.test/api/assets',
      undefined,
      {
        CATALOG_CACHE: cache,
        CATALOG_STALE_MS: '3600000',
      }
    )

    expect(response.status).toBe(200)

    const payload = await response.json()

    expect(payload.meta.source).toBe('cache')
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].name).toBe('Cached Camera')
  })

  test('syncs a Notion catalog into KV when the admin token is valid', async () => {
    const cache = new MemoryKV()

    globalThis.fetch = async (input, init) => {
      expect(String(input)).toContain('/v1/data-sources/ds_123/query')
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer notion_secret',
      })

      return Response.json({
        results: [
          {
            id: 'page_dji_mini_4_pro',
            properties: {
              Name: {
                type: 'title',
                title: [
                  {
                    plain_text: 'DJI Mini 4 Pro',
                  },
                ],
              },
              Category: {
                type: 'select',
                select: {
                  name: 'Electronics',
                },
              },
              PurchasePrice: {
                type: 'number',
                number: 999,
              },
              CurrentPrice: {
                type: 'number',
                number: 820,
              },
              PurchaseDate: {
                type: 'date',
                date: {
                  start: '2025-01-05',
                },
              },
              Status: {
                type: 'select',
                select: {
                  name: 'active',
                },
              },
              Image: {
                type: 'files',
                files: [
                  {
                    type: 'external',
                    name: 'DJI Mini 4 Pro',
                    external: {
                      url: 'https://example.com/dji.jpg',
                    },
                  },
                ],
              },
              Notes: {
                type: 'rich_text',
                rich_text: [
                  {
                    plain_text: 'Compact travel drone.',
                  },
                ],
              },
            },
          },
        ],
      })
    }

    const response = await app.request(
      'http://local.test/api/admin/sync',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer secret',
        },
      },
      {
        ADMIN_TOKEN: 'secret',
        NOTION_API_TOKEN: 'notion_secret',
        NOTION_DATA_SOURCE_ID: 'ds_123',
        CATALOG_CACHE: cache,
      }
    )

    expect(response.status).toBe(200)

    const payload = await response.json()
    const snapshot = await cache.get('worth:catalog', 'json')

    expect(payload.meta.source).toBe('notion')
    expect(payload.items[0].name).toBe('DJI Mini 4 Pro')
    expect(payload.items[0].dailyCost).toBeGreaterThan(0)
    expect(snapshot.items[0].name).toBe('DJI Mini 4 Pro')
  })

  test('runs the same sync pipeline from the scheduled worker handler', async () => {
    const cache = new MemoryKV()
    const tasks: Promise<unknown>[] = []

    globalThis.fetch = async () =>
      Response.json({
        results: [
          {
            id: 'page_switch',
            properties: {
              Name: {
                type: 'title',
                title: [
                  {
                    plain_text: 'Nintendo Switch 2',
                  },
                ],
              },
              Category: {
                type: 'select',
                select: {
                  name: 'Consumer Goods',
                },
              },
              PurchasePrice: {
                type: 'number',
                number: 449,
              },
              CurrentPrice: {
                type: 'number',
                number: 410,
              },
              PurchaseDate: {
                type: 'date',
                date: {
                  start: '2026-01-03',
                },
              },
              Status: {
                type: 'select',
                select: {
                  name: 'active',
                },
              },
              Image: {
                type: 'files',
                files: [
                  {
                    type: 'external',
                    name: 'Nintendo Switch 2',
                    external: {
                      url: 'https://example.com/switch.jpg',
                    },
                  },
                ],
              },
            },
          },
        ],
      })

    expect(typeof app.scheduled).toBe('function')

    app.scheduled(
      {
        cron: '0 * * * *',
        scheduledTime: Date.now(),
      },
      {
        NOTION_API_TOKEN: 'notion_secret',
        NOTION_DATA_SOURCE_ID: 'ds_123',
        CATALOG_CACHE: cache,
      },
      {
        waitUntil(promise) {
          tasks.push(promise)
        },
      }
    )

    expect(tasks).toHaveLength(1)

    await Promise.all(tasks)

    const snapshot = await cache.get('worth:catalog', 'json')

    expect(snapshot.meta.source).toBe('notion')
    expect(snapshot.items[0].name).toBe('Nintendo Switch 2')
  })

  test('proxies asset images through the worker with cache-friendly headers', async () => {
    globalThis.fetch = async () =>
      new Response('binary-image', {
        headers: {
          'content-type': 'image/jpeg',
        },
      })

    const response = await app.request('http://local.test/media/macbook-pro-m3-max')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('cache-control')).toContain('public')
    expect(await response.text()).toBe('binary-image')
  })
})
