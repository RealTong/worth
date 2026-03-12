export type AssetStatus = 'active' | 'idle' | 'retired'
export type CatalogSource = 'sample' | 'notion' | 'cache'

export type AssetItem = {
  id: string
  name: string
  category: string
  purchasePrice: number
  currentPrice: number
  purchaseDate: string
  status: AssetStatus
  imageUrl: string
  notes: string
  daysOwned: number
  dailyCost: number
  priceDelta: number
}

export type CatalogSummary = {
  totalAssets: number
  activeAssets: number
  totalPurchaseValue: number
  totalCurrentValue: number
  portfolioDailyCost: number
}

export type CatalogSnapshot = {
  items: AssetItem[]
  summary: CatalogSummary
  meta: {
    source: CatalogSource
    origin?: Exclude<CatalogSource, 'cache'>
    generatedAt: string
  }
}

export type AssetSeed = Omit<AssetItem, 'daysOwned' | 'dailyCost' | 'priceDelta'>

const DAY_IN_MS = 24 * 60 * 60 * 1000

const SAMPLE_ASSETS: AssetSeed[] = [
  {
    id: 'macbook-pro-m3-max',
    name: 'MacBook Pro',
    category: 'Electronics',
    purchasePrice: 2799,
    currentPrice: 2280,
    purchaseDate: '2024-01-18',
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    notes: 'Primary work machine with the highest daily utilization.',
  },
  {
    id: 'tesla-model-y',
    name: 'Tesla Model Y',
    category: 'Vehicle',
    purchasePrice: 38200,
    currentPrice: 33100,
    purchaseDate: '2023-06-01',
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=1200&q=80',
    notes: 'Main household vehicle and the largest depreciation line item.',
  },
  {
    id: 'airpods-pro-2',
    name: 'AirPods Pro',
    category: 'Consumer Goods',
    purchasePrice: 249,
    currentPrice: 145,
    purchaseDate: '2024-08-12',
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=1200&q=80',
    notes: 'Daily commute companion with low resale value and high usage.',
  },
]

export function getSampleCatalog(now = new Date()): CatalogSnapshot {
  return buildCatalogSnapshot('sample', SAMPLE_ASSETS, now)
}

export function buildCatalogSnapshot(
  source: Exclude<CatalogSource, 'cache'>,
  assets: AssetSeed[],
  now = new Date()
): CatalogSnapshot {
  const items = assets.map((asset) => buildAssetItem(asset, now))

  return {
    items,
    summary: buildCatalogSummary(items),
    meta: {
      source,
      generatedAt: now.toISOString(),
    },
  }
}

export function buildAssetItem(asset: AssetSeed, now = new Date()): AssetItem {
  const daysOwned = getDaysOwned(asset.purchaseDate, now)

  return {
    ...asset,
    daysOwned,
    dailyCost: roundCurrency(asset.purchasePrice / daysOwned),
    priceDelta: roundCurrency(asset.currentPrice - asset.purchasePrice),
  }
}

export function buildCatalogSummary(items: AssetItem[]): CatalogSummary {
  return {
    totalAssets: items.length,
    activeAssets: items.filter((item) => item.status === 'active').length,
    totalPurchaseValue: roundCurrency(
      items.reduce((total, item) => total + item.purchasePrice, 0)
    ),
    totalCurrentValue: roundCurrency(
      items.reduce((total, item) => total + item.currentPrice, 0)
    ),
    portfolioDailyCost: roundCurrency(
      items.reduce((total, item) => total + item.dailyCost, 0)
    ),
  }
}

export function cloneSnapshotAsCache(snapshot: CatalogSnapshot): CatalogSnapshot {
  return {
    ...snapshot,
    meta: {
      ...snapshot.meta,
      source: 'cache',
      origin:
        snapshot.meta.source === 'cache' ? snapshot.meta.origin : snapshot.meta.source,
    },
  }
}

export function isSnapshotFresh(snapshot: CatalogSnapshot, staleMs: number, now = Date.now()) {
  const generatedAt = new Date(snapshot.meta.generatedAt).getTime()

  if (Number.isNaN(generatedAt)) {
    return false
  }

  return now - generatedAt <= staleMs
}

export function asCatalogSnapshot(value: unknown): CatalogSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<CatalogSnapshot>

  if (!Array.isArray(candidate.items) || !candidate.summary || !candidate.meta) {
    return null
  }

  if (typeof candidate.meta.generatedAt !== 'string') {
    return null
  }

  return candidate as CatalogSnapshot
}

export function getCatalogCacheKey() {
  return 'worth:catalog'
}

export function getAssetMediaUrl(assetId: string) {
  return `/media/${assetId}`
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function getDaysOwned(purchaseDate: string, now: Date): number {
  const start = new Date(`${purchaseDate}T00:00:00.000Z`)
  const elapsed = Math.floor((now.getTime() - start.getTime()) / DAY_IN_MS)

  return Math.max(elapsed + 1, 1)
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}
