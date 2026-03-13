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

class MemoryR2 {
  private store = new Map<
    string,
    {
      body: string
      contentType?: string
    }
  >()

  async get(key: string) {
    const value = this.store.get(key)

    if (!value) {
      return null
    }

    return {
      body: value.body,
      async text() {
        return value.body
      },
      writeHttpMetadata(headers: Headers) {
        if (value.contentType) {
          headers.set('content-type', value.contentType)
        }
      },
    }
  }

  async put(
    key: string,
    value: BodyInit | null,
    options?: {
      httpMetadata?: {
        contentType?: string
      }
    }
  ) {
    const body = value ? await new Response(value).text() : ''

    this.store.set(key, {
      body,
      contentType: options?.httpMetadata?.contentType,
    })
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
    const response = await app.request('http://local.test/', {
      headers: {
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    })

    expect(response.status).toBe(200)

    const html = await response.text()

    expect(html).toContain('<html lang="zh-CN">')
    expect(html).toContain('<title>日均成本账本</title>')
    expect(html).toContain('日均成本账本')
    expect(html).toContain('总购入')
    expect(html).toContain('日均成本')
    expect(html).toContain('MacBook Pro')
    expect(html).toContain('/media/macbook-pro-m3-max')
    expect(html).toContain('site-head')
    expect(html).toContain('asset-grid')
    expect(html).toContain('?lang=en')
  })

  test('lets the query locale override browser language on the page', async () => {
    const response = await app.request('http://local.test/?lang=en', {
      headers: {
        'accept-language': 'zh-CN,zh;q=0.9',
      },
    })

    expect(response.status).toBe(200)

    const html = await response.text()

    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<title>Daily Cost Ledger</title>')
    expect(html).toContain('Daily Cost Ledger')
    expect(html).toContain('Total Spend')
    expect(html).toContain('Daily Cost')
    expect(html).toContain('?lang=zh-CN')
    expect(html).not.toContain('日均成本账本')
  })

  test('returns a client error when manual sync runs without Notion config', async () => {
    const response = await app.request('http://local.test/api/admin/sync', {
      method: 'POST',
    })

    expect(response.status).toBe(400)
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
            currency: 'USD',
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
        KV: cache,
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
    const bucket = new MemoryR2()

    globalThis.fetch = async (input, init) => {
      if (String(input) === 'https://assets.notion.local/iphone.png') {
        return new Response('iphone-image', {
          headers: {
            'content-type': 'image/png',
          },
        })
      }

      expect(String(input)).toContain('/v1/data_sources/ds_123/query')
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer notion_secret',
      })

      return Response.json({
        results: [
          {
            id: 'page_iphone_15_pro',
            properties: {
              名称: {
                type: 'title',
                title: [
                  {
                    plain_text: 'iPhone 15 Pro',
                  },
                ],
              },
              购买价格: {
                type: 'number',
                number: 8999,
              },
              货币: {
                type: 'select',
                select: {
                  name: 'CNY',
                },
              },
              购买时间: {
                type: 'date',
                date: {
                  start: '2023-10-01',
                },
              },
              服役状态: {
                type: 'select',
                select: {
                  name: '服役中',
                },
              },
              产品图片: {
                type: 'files',
                files: [
                  {
                    type: 'file',
                    name: 'image.png',
                    file: {
                      url: 'https://assets.notion.local/iphone.png',
                    },
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
      },
      {
        NOTION_API_TOKEN: 'notion_secret',
        NOTION_DATA_SOURCE_ID: 'ds_123',
        KV: cache,
        R2: bucket,
      }
    )

    expect(response.status).toBe(200)

    const payload = await response.json()
    const snapshot = await cache.get('worth:catalog', 'json')
    const cachedImage = await bucket.get('assets/page_iphone_15_pro')

    expect(payload.meta.source).toBe('notion')
    expect(payload.items[0].name).toBe('iPhone 15 Pro')
    expect(payload.items[0].currency).toBe('CNY')
    expect(payload.items[0].dailyCost).toBeGreaterThan(0)
    expect(snapshot.items[0].name).toBe('iPhone 15 Pro')
    expect(snapshot.items[0].currency).toBe('CNY')
    expect(await cachedImage?.text()).toBe('iphone-image')
  })

  test('runs the same sync pipeline from the scheduled worker handler', async () => {
    const cache = new MemoryKV()
    const bucket = new MemoryR2()
    const tasks: Promise<unknown>[] = []

    globalThis.fetch = async (input) => {
      if (String(input) === 'https://assets.notion.local/switch.png') {
        return new Response('switch-image', {
          headers: {
            'content-type': 'image/png',
          },
        })
      }

      return Response.json({
        results: [
          {
            id: 'page_switch',
            properties: {
              名称: {
                type: 'title',
                title: [
                  {
                    plain_text: 'Nintendo Switch 2',
                  },
                ],
              },
              购买价格: {
                type: 'number',
                number: 449,
              },
              货币: {
                type: 'select',
                select: {
                  name: 'USD',
                },
              },
              购买时间: {
                type: 'date',
                date: {
                  start: '2026-01-03',
                },
              },
              服役状态: {
                type: 'select',
                select: {
                  name: '服役中',
                },
              },
              产品图片: {
                type: 'files',
                files: [
                  {
                    type: 'file',
                    name: 'switch.png',
                    file: {
                      url: 'https://assets.notion.local/switch.png',
                    },
                  },
                ],
              },
            },
          },
        ],
      })
    }

    expect(typeof app.scheduled).toBe('function')

    app.scheduled(
      {
        cron: '0 * * * *',
        scheduledTime: Date.now(),
      },
      {
        NOTION_API_TOKEN: 'notion_secret',
        NOTION_DATA_SOURCE_ID: 'ds_123',
        KV: cache,
        R2: bucket,
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
    const cachedImage = await bucket.get('assets/page_switch')

    expect(snapshot.meta.source).toBe('notion')
    expect(snapshot.items[0].name).toBe('Nintendo Switch 2')
    expect(snapshot.items[0].currency).toBe('USD')
    expect(await cachedImage?.text()).toBe('switch-image')
  })

  test('serves asset images from R2 before falling back to upstream fetches', async () => {
    const bucket = new MemoryR2()

    await bucket.put('assets/macbook-pro-m3-max', 'r2-image', {
      httpMetadata: {
        contentType: 'image/webp',
      },
    })

    globalThis.fetch = async () => {
      throw new Error('upstream fetch should not run when R2 already has the image')
    }

    const response = await app.request(
      'http://local.test/media/macbook-pro-m3-max',
      undefined,
      {
        R2: bucket,
      }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/webp')
    expect(response.headers.get('cache-control')).toContain('public')
    expect(await response.text()).toBe('r2-image')
  })
})
