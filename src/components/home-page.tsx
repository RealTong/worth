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
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">Asset cost ledger</p>
          <h1>Worth Ledger</h1>
          <p class="hero-text">
            Track what you bought, how long it has been in service, and how much
            each day of ownership is actually costing you.
          </p>
        </div>
        <div class="hero-metric">
          <span class="metric-label">Portfolio Daily Cost</span>
          <strong>
            {formatCurrency(
              snapshot.summary.portfolioDailyCost,
              snapshot.summary.currency
            )}
          </strong>
          <span class="metric-caption">
            Based on elapsed ownership days across {snapshot.summary.totalAssets}{' '}
            tracked items.
          </span>
        </div>
      </section>

      <section class="summary-strip" aria-label="Portfolio summary">
        <article>
          <span>Total Purchase Value</span>
          <strong>
            {formatCurrency(
              snapshot.summary.totalPurchaseValue,
              snapshot.summary.currency
            )}
          </strong>
        </article>
        <article>
          <span>Current Estimated Value</span>
          <strong>
            {formatCurrency(
              snapshot.summary.totalCurrentValue,
              snapshot.summary.currency
            )}
          </strong>
        </article>
        <article>
          <span>Active Assets</span>
          <strong>{snapshot.summary.activeAssets}</strong>
        </article>
      </section>

      <section class="asset-section">
        <div class="section-heading">
          <p class="eyebrow">Live inventory</p>
          <h2>What is costing you money right now</h2>
        </div>

        <div class="asset-grid">
          {snapshot.items.map((item) => (
            <article class="asset-card" key={item.id}>
              <div
                class="asset-image"
                style={`background-image: linear-gradient(160deg, rgb(22 29 41 / 0.15), rgb(22 29 41 / 0.65)), url(${getAssetMediaUrl(item.id)});`}
              />
              <div class="asset-body">
                <div class="asset-header">
                  <div>
                    <p class="asset-category">
                      {item.category} · {item.currency}
                    </p>
                    <h3>{item.name}</h3>
                  </div>
                  <span class={`status-pill status-${item.status}`}>
                    {getStatusLabel(item.status)}
                  </span>
                </div>

                <dl class="asset-stats">
                  <div>
                    <dt>Purchase</dt>
                    <dd>{formatCurrency(item.purchasePrice, item.currency)}</dd>
                  </div>
                  <div>
                    <dt>Current</dt>
                    <dd>{formatCurrency(item.currentPrice, item.currency)}</dd>
                  </div>
                  <div>
                    <dt>Daily cost</dt>
                    <dd>{formatCurrency(item.dailyCost, item.currency)}</dd>
                  </div>
                  <div>
                    <dt>Days owned</dt>
                    <dd>{item.daysOwned}</dd>
                  </div>
                </dl>

                {item.notes ? <p class="asset-notes">{item.notes}</p> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
