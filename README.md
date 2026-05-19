# Proxy Embed

> A multi-runtime reverse proxy — runs on **Vercel Edge Functions** (modern), **Cloudflare Workers**, or as a **legacy Express server** (Node.js / Railway). Forwards HTTP/WebSocket requests to configurable backend URLs with rate limiting, IP filtering, proxy rotation/failover, smart caching, and media streaming support.

## Why Proxy Embed?

| Benefit | What it means for you |
|---------|----------------------|
| **Multi-runtime** | Run the same proxy on **Vercel Edge Functions**, **Cloudflare Workers**, or **Node.js** — no code changes needed, pick the runtime that fits your stack |
| **Abuse protection** | Rate limiting + IP blocklisting + auto-ban stops malicious traffic before it reaches your backend |
| **High availability** | Automatic failover across multiple backend URLs — if one goes down, traffic routes to the next |
| **Global edge caching** | Content-type-aware caching with TTLs up to 12h — reduces backend load and speeds up delivery |
| **Media streaming ready** | Range request support (seeking), HLS/DASH caching, SSE passthrough — works out of the box with video/audio |
| **Hide your origin** | Clients never see your real backend — the proxy sits in front as a shield |
| **Real IP detection** | Accurately identifies client IPs behind CDNs, load balancers, and Vercel/Cloudflare — no misattribution |
| **WebSocket passthrough** | Proxies WebSocket connections with the same rate limiting and IP filtering as HTTP |
| **CORS for everyone** | Wildcard CORS headers on every response — any frontend can talk to your backend |
| **Attack detection** | Per-IP-per-path abuse detection with auto-de-escalating cache absorption — slows down attackers automatically |
| **Production ready** | Auto-restart on crash, memory-safe IP tracking (capped at 100k), periodic cleanup of stale data |

## Project Structure

```
index.js      — Process manager (spawns proxy.js with auto-restart)
proxy.js      — Express reverse proxy (Node.js / Railway) — **legacy**, use edge.js instead
edge.js       — Vercel Edge Functions runtime (modern replacement for proxy.js)
workers.js    — Cloudflare Workers edge deployment (standalone)
```

Three runtime implementations. **`edge.js` is the modern, recommended runtime** — `proxy.js` is kept for backward compatibility on Node.js / Railway.

## How It Works

### 1. Process Manager (`index.js`)

Spawns `proxy.js` as a child process. If the `PID` environment variable is set to anything other than `"0"`, the process auto-restarts on crash — ideal for production deployments on Railway or similar platforms.

### 2. Express Proxy (`proxy.js`) — Legacy

> ⚠️ **Legacy.** Use `edge.js` for new deployments. The Express proxy is kept for backward compatibility on Node.js / Railway.

An Express server that acts as a middleman between clients and backend services:

- **Proxy targets** — Reads from `proxy-config.json`, `PROXY_URL`, or `PROXY_URLS` environment variable
- **Client IP detection** — Detects the real client IP via headers like `x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`, `forwarded`, and Vercel-specific headers
- **Rate limiting** — Per-IP request tracking with configurable time window and max requests
- **IP blocking** — Static blocklist plus auto-ban after repeated violations
- **IP probing** — Probes banned/blocked IPs with HTTP requests (to detect when they come back online)
- **Proxy rotation** — Failover across multiple backend URLs on error (ECONNREFUSED, ETIMEDOUT, etc.)
- **Header forwarding** — Passes through `User-Agent`, `Accept`, `Authorization`, `Cookie`, `Referer`, `Origin`, and other headers
- **CORS** — Wildcard CORS headers on all responses
- **Streaming** — Optimized headers for SSE (`text/event-stream`) and streaming JSON
- **WebSocket** — Upgrade passthrough with rate limiting and IP filtering
- **Caching** — Smart `Cache-Control` headers based on content type
- **Attack detection** — Per-IP-per-path request tracking with adaptive time windows. When an IP exceeds the attack threshold on a specific path, the path enters **cache absorption mode** — JSON responses get a short cache TTL to protect the backend
- **Auto-de-escalation** — Cache punishment automatically expires after `CACHE_PUNISHMENT_TTL` seconds without further attacks
- **OOM protection** — Memory-safe tracking with caps on tracked IPs (`MAX_TRACKED_IPS`, `MAX_TRACKED_PATH_IPS`) and oldest-entry eviction

### 2b. Edge Runtime (`edge.js`) — Modern

> 🚀 **Recommended runtime.** Deploys to Vercel Edge Functions — lower latency, global distribution, no servers to manage.

A lightweight edge-native proxy using the Web `fetch` / `Request` / `Response` APIs:

- **Proxy targets** — Reads from `PROXY_URL` or `PROXY_URLS` environment variables
- **Client IP detection** — Detects the real client IP via `forwarded`, `x-vercel-forwarded-for`, `x-forwarded-for`, `x-real-ip`, and `cf-connecting-ip` headers
- **Rate limiting** — Per-IP request tracking with configurable time window and max requests
- **IP blocking** — Static blocklist plus auto-ban after repeated violations
- **Multi-origin failover** — Tries each proxy URL in sequence; if one fails, falls through to the next
- **Header forwarding** — Passes through all client headers, plus adds `X-Client-IP`, `X-Forwarded-For`, `X-Real-IP`
- **CORS** — Wildcard CORS headers on all responses (including preflight `OPTIONS`)
- **Smart caching** — Content-type-aware `Cache-Control` and `CDN-Cache-Control` TTLs with in-memory response cache
- **Attack detection** — Per-IP-per-path request tracking with cache absorption for JSON responses under attack
- **Auto-de-escalation** — Cache punishment automatically expires after `CACHE_PUNISHMENT_TTL` seconds
- **Memory-safe** — Stale entry cleanup every 15 seconds via interval

> **Key difference from `proxy.js`:** `edge.js` runs on Vercel's Edge Runtime (no Express, no Node.js APIs), uses the native `fetch` API, and is globally distributed by default. WebSocket passthrough is not supported on Vercel Edge Functions.

### 3. Cloudflare Worker (`workers.js`)

Same functionality deployed at the edge via Cloudflare Workers, plus:

- **Multi-origin failover** — Tries each origin URL in sequence, skipping 5xx errors
- **Smart caching** — Content-type-aware TTLs (HLS/DASH: 12h, images/video/audio: 12h, HTML: 1h, API/JSON/streams: no cache)
- **Range requests** — Partial content support for media streaming (`206 Partial Content`)
- **WebSocket pass-through** — Proxy WebSocket upgrade requests to origin servers
- **Cloudflare optimizations** — Polish (lossy image compression), Mirage (lazy loading), cache everything

## Quick Start

### Local Development

```bash
git clone <repo-url>
cd proxy-embed
npm install
npm start
```

The server starts on port `3000` by default.

### Deploy to Cloudflare Workers

```bash
npx wrangler deploy
```

## Configuration

### Method 1: Config File

Edit `proxy-config.json` in the project root:

```json
{
    "proxyUrls": ["https://your-backend.com"],
    "blockedIps": ["1.2.3.4"],
    "internalProxyIps": ["5.6.7.8"]
}
```

### Method 2: Environment Variables

```bash
# Single target
PROXY_URL=https://your-backend.com npm start

# Multiple targets (failover)
PROXY_URLS='["https://backup1.com","https://backup2.com"]' npm start
```

### Method 3: Cloudflare Workers

Edit the `ORIGIN_URLS` array at the top of `workers.js`:

```js
const ORIGIN_URLS = [
  'https://your-backend.com',
];
```

### Configuration Priority

`proxy-config.json` > `PROXY_URL` / `PROXY_URLS` env > default (`https://proxy-embed.nethriondev.workers.dev`)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROXY_URL` | Single backend target URL | — |
| `PROXY_URLS` | JSON array of backend URLs | — |
| `BLOCKED_IPS` | JSON array of IPs to block | `["72.60.237.246"]` |
| `INTERNAL_PROXY_IPS` | JSON array of trusted proxy IPs (bypass rate limits) | `["162.220.234.134"]` |
| `PORT` | Server port | `3000` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit time window (ms) | `60000` (1 min) |
| `MAX_REQUESTS_PER_WINDOW` | Max requests per window per IP | `200` |
| `BAN_THRESHOLD` | Violations before auto-ban | `3` |
| `BAN_DURATION_MS` | Auto-ban duration (ms) | `900000` (15 min) |
| `MAX_TRACKED_IPS` | Max tracked IPs in memory | `100000` |
| `MAX_TRACKED_PATH_IPS` | Max tracked IP-path pairs in memory (attack detection) | `50000` |
| `PID` | Set to `"0"` to disable auto-restart | — |

## Rate Limiting & IP Blocking

- Each IP is tracked by request **frequency** (requests per time window)
- After `BAN_THRESHOLD` violations, the IP is **auto-banned** for `BAN_DURATION_MS`
- Expired bans and stale tracking data are cleaned up every 15 seconds
- Trusted/internal proxy IPs bypass all rate limiting and blocking

## Attack Detection & Cache Absorption

In addition to per-IP rate limiting, the proxy includes a **per-IP-per-path attack detection** system:

- Every request tracks its **IP + path** combo with timestamps within a sliding time window
- Media paths (`.m3u8`, `.mp4`, `.jpg`, etc.) use a **12-hour window**; all other paths use a **300-second window**
- When a single IP exceeds **500 requests** on the same path within the window, the path is flagged as **under attack**
- **Cache absorption** — JSON responses on attacked paths receive a short `Cache-Control: max-age=300` (instead of no caching), causing CDNs and browsers to serve stale cached responses and reduce backend load
- **Auto-de-escalation** — After 300 seconds without further attack activity on a path, the cache punishment is automatically lifted
- **OOM protection** — Both `ipRequests` and `ipPathTimestamps` maps are capped (`MAX_TRACKED_IPS` and `MAX_TRACKED_PATH_IPS`), with oldest entries evicted when limits are reached

### Behavior by Platform

| Action | Express (proxy.js) — Legacy | Edge (edge.js) — Modern | Workers (workers.js) |
|--------|-----------------------------|------------------------|---------------------|
| Rate limited | Socket destroyed | `429 Too Many Requests` | `429 Too Many Requests` |
| Banned | HTTP redirect to `http://{ip}` | `429 Too Many Requests` | `429 Too Many Requests` |
| Blocklisted | HTTP redirect to `http://{ip}` | `403 Forbidden` | `403 Forbidden` |
| Attack detected | Cache absorption (300s TTL on JSON) | Cache absorption (300s TTL on JSON) | Cache absorption (300s TTL on JSON) |

> **Note:** The Express version redirects banned IPs to their own IP address as a probing mechanism (to detect when the IP comes back online). The Edge and Worker versions return proper HTTP status codes.

## Proxy Rotation & Failover

When a proxy URL encounters an error (`ECONNREFUSED`, `ETIMEDOUT`, etc.):

- **Multiple URLs configured** — Rotates to the next URL in the list and returns a `502`/`504` with info about the next proxy
- **Single URL configured** — Returns the error directly with a note that rotation is disabled

## Streaming & Media Support

- **SSE / Streaming JSON** — `text/event-stream` and `application/stream+json` responses get `no-cache`, `no-transform`, and `no content-length` headers for proper streaming
- **Range requests** — `206 Partial Content` responses preserve `Content-Range` and set `Accept-Ranges: bytes` for video/audio seeking
- **HLS / DASH** — `.m3u8`, `.mpd`, `.ts`, `.m4s` segments are cached aggressively (12h TTL)

## CORS

All endpoints include:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Accept, X-Stream, Range
Access-Control-Expose-Headers: *
```

## Caching Strategy

Both deployments apply content-type-aware `Cache-Control` headers:

| Content Type | Cache TTL | Example |
|-------------|-----------|---------|
| HLS/DASH playlists & segments | 12 hours | `.m3u8`, `.mpd`, `.ts`, `.m4s` |
| Images | 12 hours | `.jpg`, `.png`, `.gif`, `.webp`, `.svg` |
| Video | 12 hours | `.mp4`, `.webm`, `.avi`, `.mov` |
| Audio | 12 hours | `.mp3`, `.wav`, `.ogg`, `.m4a` |
| HTML / JS / CSS | 1 hour | — |
| API / JSON / SSE | No cache | `/api/*` paths, `.json` |
| Error responses (non-200/206) | No cache | — |
| Attack-detected paths (JSON only) | 5 minutes | Cache absorber active |
| Range requests | 1 hour | — |

## Deployments

| Platform | Entry Point | Config Source |
|----------|-------------|---------------|
| Node.js / Railway | `index.js` (spawns `proxy.js`) | `proxy-config.json` or env vars |
| Vercel Edge (modern) | `edge.js` | Vercel env vars |
| Vercel Serverless (legacy) | `proxy.js` | `vercel.json` + env vars |
| Cloudflare Workers | `workers.js` | `wrangler.toml` / edit `ORIGIN_URLS` |

## WebSocket Support

WebSocket upgrades (`Upgrade: websocket`) are supported in the following deployments:

- **Express (`proxy.js`)** — Full WebSocket proxy with rate limiting and IP filtering. Connects to the configured proxy URLs using `wss://` protocol
- **Workers (`workers.js`)** — WebSocket requests are forwarded directly to origin servers with failover
- **Edge (`edge.js`)** — WebSocket passthrough is **not supported** on Vercel Edge Functions

## License

MIT © Kenneth Panio
