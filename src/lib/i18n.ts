import type { AssetStatus, CatalogSnapshot, CurrencyCode } from './catalog'

export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

type LocaleMessages = {
  title: string
  description: string
  totalSpend: string
  dailyCost: string
  activeAssets: string
  purchasePrice: string
  acquiredOn: string
  noImage: string
  languageLabel: string
  assetGridLabel: string
  localeName: string
}

const MESSAGES: Record<AppLocale, LocaleMessages> = {
  'zh-CN': {
    title: '日均成本账本',
    description: '记录你拥有的东西，以及它们每天在花多少钱。',
    totalSpend: '总购入',
    dailyCost: '日均成本',
    activeAssets: '在役',
    purchasePrice: '购入',
    acquiredOn: '购入于',
    noImage: '暂无图片',
    languageLabel: '语言',
    assetGridLabel: '资产列表',
    localeName: '中文',
  },
  en: {
    title: 'Daily Cost Ledger',
    description: 'A quiet record of what you own and what it costs per day.',
    totalSpend: 'Total Spend',
    dailyCost: 'Daily Cost',
    activeAssets: 'Active',
    purchasePrice: 'Purchase',
    acquiredOn: 'Acquired',
    noImage: 'No image',
    languageLabel: 'Language',
    assetGridLabel: 'Asset gallery',
    localeName: 'English',
  },
}

export function resolveLocale(url: URL, acceptLanguage?: string | null): AppLocale {
  return (
    normalizeLocale(url.searchParams.get('lang')) ??
    resolveAcceptLanguage(acceptLanguage) ??
    'zh-CN'
  )
}

export function getMessages(locale: AppLocale) {
  return MESSAGES[locale]
}

export function buildLocaleHref(url: URL, locale: AppLocale) {
  const next = new URL(url.toString())

  next.searchParams.set('lang', locale)

  return `${next.pathname}${next.search}`
}

export function formatCurrencyForLocale(
  value: number,
  currency: CurrencyCode = 'USD',
  locale: AppLocale
) {
  if (currency === 'MIXED') {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(value)
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDateForLocale(value: string, locale: AppLocale) {
  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date)
}

export function getStatusLabelForLocale(status: AssetStatus, locale: AppLocale) {
  if (locale === 'zh-CN') {
    if (status === 'idle') {
      return '闲置'
    }

    if (status === 'retired') {
      return '已退役'
    }

    return '服役中'
  }

  if (status === 'idle') {
    return 'Idle'
  }

  if (status === 'retired') {
    return 'Retired'
  }

  return 'Active'
}

export function formatActiveRatio(snapshot: CatalogSnapshot) {
  return `${snapshot.summary.activeAssets}/${snapshot.summary.totalAssets}`
}

function normalizeLocale(value: string | null) {
  if (!value) {
    return null
  }

  const candidate = value.trim().toLowerCase()

  if (candidate.startsWith('zh')) {
    return 'zh-CN'
  }

  if (candidate.startsWith('en')) {
    return 'en'
  }

  return null
}

function resolveAcceptLanguage(header?: string | null) {
  if (!header) {
    return null
  }

  for (const part of header.split(',')) {
    const [token] = part.trim().split(';')
    const locale = normalizeLocale(token)

    if (locale) {
      return locale
    }
  }

  return null
}
