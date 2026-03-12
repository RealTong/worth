# Worth Ledger

A Cloudflare Workers + Hono + Vite app for tracking the ownership cost of electronics, vehicles, and consumer goods.

## What is implemented

- SSR dashboard at `/`
- JSON API at `/api/assets`
- Public manual sync endpoint at `POST /api/admin/sync`
- Cloudflare `scheduled()` hook for cron-driven sync
- Notion data-source ingestion with `KV` snapshot caching
- R2-backed image caching behind `/media/:assetId`
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
NOTION_API_TOKEN=secret_xxx
NOTION_DATA_SOURCE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CATALOG_STALE_MS=21600000
```

## Cloudflare bindings

Bind your namespaces exactly as `KV` and `R2`.

Example `wrangler.jsonc` snippet:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "your-kv-namespace-id"
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "your-r2-bucket"
    }
  ],
  "triggers": {
    "crons": ["0 * * * *"]
  }
}
```

## Notion property mapping

The live database currently uses these fields:

- `名称`: title
- `产品图片`: files
- `购买价格`: number
- `货币`: select (`CNY`, `USD`)
- `购买时间`: date
- `服役状态`: select (`服役中`, `已退役`, `已出售`)

## Response shape

`GET /api/assets` returns:

- `items`: normalized assets with `currency`, `dailyCost`, and `mediaUrl`
- `summary`: totals for purchase value, current value, active assets, and portfolio daily cost
- `meta`: snapshot source (`sample`, `cache`, or `notion`) and timestamp

## Notes

- The current daily cost formula is `purchasePrice / daysOwned`.
- If `KV` has a fresh snapshot, the app serves cache first.
- If Notion fetch fails but `KV` has stale data, the app falls back to the cached snapshot.
- Sync downloads product images into `R2`, and `/media/:assetId` serves R2 first before falling back to the upstream Notion file URL.
