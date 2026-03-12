import { AssetSeed, AssetStatus, buildCatalogSnapshot, CatalogSnapshot } from './catalog'

type NotionTextBlock = {
  plain_text?: string
  text?: {
    content?: string
  }
}

type NotionProperty = {
  title?: NotionTextBlock[]
  rich_text?: NotionTextBlock[]
  select?: {
    name?: string
  } | null
  number?: number | null
  date?: {
    start?: string | null
  } | null
  files?: Array<{
    external?: {
      url?: string
    }
    file?: {
      url?: string
    }
  }>
}

type NotionPage = {
  id: string
  cover?: {
    external?: {
      url?: string
    }
    file?: {
      url?: string
    }
  } | null
  properties?: Record<string, NotionProperty>
}

type NotionQueryResponse = {
  results?: NotionPage[]
  has_more?: boolean
  next_cursor?: string | null
}

type NotionConfig = {
  apiToken: string
  dataSourceId: string
}

const NOTION_VERSION = '2026-03-11'

export async function syncNotionCatalog(
  config: NotionConfig,
  now = new Date()
): Promise<CatalogSnapshot> {
  const pages = await fetchAllNotionPages(config)
  const assets = pages.map((page) => mapNotionPageToAsset(page))

  return buildCatalogSnapshot('notion', assets, now)
}

async function fetchAllNotionPages(config: NotionConfig): Promise<NotionPage[]> {
  const results: NotionPage[] = []
  let nextCursor: string | undefined

  do {
    const response = await fetch(
      `https://api.notion.com/v1/data_sources/${config.dataSourceId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_VERSION,
        },
        body: JSON.stringify({
          page_size: 100,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Notion sync failed with status ${response.status}`)
    }

    const payload = (await response.json()) as NotionQueryResponse

    results.push(...(payload.results ?? []))
    nextCursor = payload.has_more ? payload.next_cursor ?? undefined : undefined
  } while (nextCursor)

  return results
}

function mapNotionPageToAsset(page: NotionPage): AssetSeed {
  const properties = page.properties ?? {}
  const purchasePrice = readNumber(properties, [
    'PurchasePrice',
    'Purchase Price',
    '购买价格',
    '买入价格',
    '价格',
  ])

  return {
    id: page.id,
    name: readTitle(properties, ['Name', '名称', 'Title']) ?? 'Untitled asset',
    category: readSelect(properties, ['Category', '分类']) ?? 'Personal Asset',
    currency: readSelect(properties, ['货币', 'Currency']) ?? 'USD',
    purchasePrice,
    currentPrice:
      readNumber(properties, ['CurrentPrice', 'Current Price', '现价']) || purchasePrice,
    purchaseDate:
      readDate(properties, ['PurchaseDate', 'Purchase Date', '购买日期', '购买时间']) ??
      new Date().toISOString().slice(0, 10),
    status: normalizeStatus(readSelect(properties, ['Status', '状态', '服役状态'])),
    imageUrl:
      readFile(properties, ['Image', '图片', '产品图片']) ??
      page.cover?.external?.url ??
      page.cover?.file?.url ??
      '',
    notes: readRichText(properties, ['Notes', '备注', 'Comment']) ?? '',
  }
}

function normalizeStatus(value: string | undefined): AssetStatus {
  const normalized = value?.trim().toLowerCase()

  if (normalized === 'idle' || normalized === '闲置') {
    return 'idle'
  }

  if (
    normalized === 'retired' ||
    normalized === 'sold' ||
    normalized === '退役' ||
    normalized === '已出售' ||
    normalized === '已退役'
  ) {
    return 'retired'
  }

  return 'active'
}

function readTitle(
  properties: Record<string, NotionProperty>,
  aliases: string[]
): string | undefined {
  const property = findProperty(properties, aliases)
  const text = property?.title?.map(readPlainText).join('').trim()

  return text || undefined
}

function readRichText(
  properties: Record<string, NotionProperty>,
  aliases: string[]
): string | undefined {
  const property = findProperty(properties, aliases)
  const text = property?.rich_text?.map(readPlainText).join('').trim()

  return text || undefined
}

function readSelect(
  properties: Record<string, NotionProperty>,
  aliases: string[]
): string | undefined {
  return findProperty(properties, aliases)?.select?.name ?? undefined
}

function readNumber(
  properties: Record<string, NotionProperty>,
  aliases: string[]
): number {
  return findProperty(properties, aliases)?.number ?? 0
}

function readDate(
  properties: Record<string, NotionProperty>,
  aliases: string[]
): string | undefined {
  return findProperty(properties, aliases)?.date?.start ?? undefined
}

function readFile(
  properties: Record<string, NotionProperty>,
  aliases: string[]
): string | undefined {
  const file = findProperty(properties, aliases)?.files?.[0]

  return file?.external?.url ?? file?.file?.url ?? undefined
}

function findProperty(
  properties: Record<string, NotionProperty>,
  aliases: string[]
): NotionProperty | undefined {
  const normalizedAliases = aliases.map(normalizeKey)

  return Object.entries(properties).find(([key]) =>
    normalizedAliases.includes(normalizeKey(key))
  )?.[1]
}

function normalizeKey(value: string) {
  return value.replace(/[\s_-]/g, '').toLowerCase()
}

function readPlainText(text: NotionTextBlock) {
  return text.plain_text ?? text.text?.content ?? ''
}
