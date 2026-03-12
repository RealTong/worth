# Worth Ledger

A Cloudflare Workers + Hono + Vite app for tracking the ownership cost of electronics, vehicles, and consumer goods.

## What is implemented

- SSR dashboard at `/`
- JSON API at `/api/assets`
- Protected manual sync endpoint at `POST /api/admin/sync`
- Cloudflare `scheduled()` hook for cron-driven sync
- Notion data-source ingestion with KV snapshot caching
- Worker image proxy at `/media/:assetId` with cache-friendly headers
- Sample fallback dataset when Notion is not configured

## Local commands

```txt
bun install
bun run dev
bun test
bun run build
```

## Environment variables

Create `.dev.vars` locally or set the same values in Cloudflare:

```txt
ADMIN_TOKEN=replace-me
NOTION_API_TOKEN=secret_xxx
NOTION_DATA_SOURCE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CATALOG_STALE_MS=21600000
```

## Cloudflare bindings

Bind a KV namespace as `CATALOG_CACHE`.

Example `wrangler.jsonc` snippet:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "CATALOG_CACHE",
      "id": "your-kv-namespace-id"
    }
  ],
  "triggers": {
    "crons": ["0 * * * *"]
  }
}
```

## Notion property mapping

The sync layer accepts either English or Chinese field names. Recommended properties:

- `Name` or `名称`: title
- `Category` or `分类`: select
- `PurchasePrice` / `Purchase Price` / `买入价格`: number
- `CurrentPrice` / `Current Price` / `现价`: number
- `PurchaseDate` / `Purchase Date` / `购买日期`: date
- `Status` or `状态`: select (`active`, `idle`, `retired`)
- `Image` or `图片`: files
- `Notes` or `备注`: rich text

## Response shape

`GET /api/assets` returns:

- `items`: normalized assets with `dailyCost` and `mediaUrl`
- `summary`: totals for purchase value, current value, active assets, and portfolio daily cost
- `meta`: snapshot source (`sample`, `cache`, or `notion`) and timestamp

## Notes

- The current daily cost formula is `purchasePrice / daysOwned`.
- If KV has a fresh snapshot, the app serves cache first.
- If Notion fetch fails but KV has stale data, the app falls back to the cached snapshot.
- The image proxy lets Cloudflare cache remote and expiring Notion file URLs behind a stable path.
