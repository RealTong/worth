import { CatalogSnapshot, getAssetMediaUrl } from '../lib/catalog'
import {
  AppLocale,
  buildLocaleHref,
  formatCurrencyForLocale,
  formatDateForLocale,
  formatActiveRatio,
  getMessages,
  getStatusLabelForLocale,
  SUPPORTED_LOCALES,
} from '../lib/i18n'

type HomePageProps = {
  snapshot: CatalogSnapshot
  locale: AppLocale
  requestUrl: URL
}

export function HomePage({ snapshot, locale, requestUrl }: HomePageProps) {
  const messages = getMessages(locale)

  return (
    <main class="page-shell">
      <header class="site-head">
        <div class="site-bar">
          <div class="site-copy">
            <h1>{messages.title}</h1>
            <p>{messages.description}</p>
          </div>

          <nav aria-label={messages.languageLabel} class="locale-switch">
            {SUPPORTED_LOCALES.map((targetLocale) => {
              const targetMessages = getMessages(targetLocale)
              const isCurrent = targetLocale === locale

              return (
                <a
                  aria-current={isCurrent ? 'page' : undefined}
                  class={`locale-link${isCurrent ? ' locale-link-active' : ''}`}
                  href={buildLocaleHref(requestUrl, targetLocale)}
                  key={targetLocale}
                >
                  {targetMessages.localeName}
                </a>
              )
            })}
          </nav>
        </div>

        <dl class="site-summary">
          <div>
            <dt>{messages.totalSpend}</dt>
            <dd>
              {formatCurrencyForLocale(
                snapshot.summary.totalPurchaseValue,
                snapshot.summary.currency,
                locale
              )}
            </dd>
          </div>
          <div>
            <dt>{messages.dailyCost}</dt>
            <dd>
              {formatCurrencyForLocale(
                snapshot.summary.portfolioDailyCost,
                snapshot.summary.currency,
                locale
              )}
            </dd>
          </div>
          <div>
            <dt>{messages.activeAssets}</dt>
            <dd>{formatActiveRatio(snapshot)}</dd>
          </div>
        </dl>
      </header>

      <section aria-label={messages.assetGridLabel} class="asset-grid">
        {snapshot.items.map((item) => (
          <article class="asset-card" key={item.id}>
            <div
              class={`asset-media${item.imageUrl ? '' : ' asset-media-empty'}`}
              style={
                item.imageUrl
                  ? `background-image: url(${getAssetMediaUrl(item.id)});`
                  : undefined
              }
            >
              {!item.imageUrl ? <span>{messages.noImage}</span> : null}
            </div>

            <div class="asset-copy-block">
              <div class="asset-meta">
                <span class="asset-category">{item.category}</span>
                <span class={`asset-status asset-status-${item.status}`}>
                  {getStatusLabelForLocale(item.status, locale)}
                </span>
              </div>

              <h2 class="asset-title">{item.name}</h2>

              <dl class="asset-values">
                <div>
                  <dt>{messages.purchasePrice}</dt>
                  <dd>
                    {formatCurrencyForLocale(
                      item.purchasePrice,
                      item.currency,
                      locale
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{messages.dailyCost}</dt>
                  <dd>{formatCurrencyForLocale(item.dailyCost, item.currency, locale)}</dd>
                </div>
              </dl>

              <p class="asset-footnote">
                {messages.acquiredOn} {formatDateForLocale(item.purchaseDate, locale)} ·{' '}
                {item.currency}
              </p>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
