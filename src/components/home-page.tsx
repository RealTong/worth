import {
  CatalogSnapshot,
  formatCurrency,
  getAssetMediaUrl,
  getStatusLabel,
} from '../lib/catalog'

type HomePageProps = {
  snapshot: CatalogSnapshot
}

export function HomePage({ snapshot }: HomePageProps) {
  return (
    <main class="page-shell">
      <section class="summary-rail">
        <div class="summary-copy">
          <p class="eyebrow">Collection</p>
          <h1>Worth Collection</h1>
          <p class="summary-note">
            A quiet ledger of the things you bought, still use, and slowly pay
            for every day.
          </p>
        </div>
        <div class="summary-metrics">
          <article class="metric-tile">
            <span class="metric-label">Total Spend</span>
            <strong>
              {formatCurrency(
                snapshot.summary.totalPurchaseValue,
                snapshot.summary.currency
              )}
            </strong>
          </article>
          <article class="metric-tile metric-tile-accent">
            <span class="metric-label">Daily Carry</span>
            <strong>
              {formatCurrency(
                snapshot.summary.portfolioDailyCost,
                snapshot.summary.currency
              )}
            </strong>
          </article>
        </div>
      </section>

      <section class="gallery-section">
        <div class="section-heading section-heading-compact">
          <div>
            <p class="eyebrow">Gallery</p>
            <h2>Daily objects, quietly depreciating</h2>
          </div>
          <span class="collection-count">
            {snapshot.summary.activeAssets}/{snapshot.summary.totalAssets} active
          </span>
        </div>

        <div class="gallery-grid">
          {snapshot.items.map((item) => (
            <article class="gallery-card" key={item.id}>
              <div
                class={`gallery-media${item.imageUrl ? '' : ' gallery-media-empty'}`}
                style={
                  item.imageUrl
                    ? `background-image: url(${getAssetMediaUrl(item.id)});`
                    : undefined
                }
              >
                {!item.imageUrl ? <span>No image</span> : null}
              </div>
              <div class="gallery-body">
                <div class="gallery-topline">
                  <span class="gallery-meta">{item.category}</span>
                  <span class={`status-pill status-${item.status}`}>
                    {getStatusLabel(item.status)}
                  </span>
                </div>
                <h3 class="gallery-title">{item.name}</h3>

                <dl class="gallery-stats">
                  <div>
                    <dt>Purchase</dt>
                    <dd>{formatCurrency(item.purchasePrice, item.currency)}</dd>
                  </div>
                  <div>
                    <dt>Daily Carry</dt>
                    <dd>{formatCurrency(item.dailyCost, item.currency)}</dd>
                  </div>
                </dl>

                <p class="gallery-footnote">
                  Acquired {formatDate(item.purchaseDate)} · {item.currency}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function formatDate(value: string) {
  return value.replaceAll('-', '.')
}
