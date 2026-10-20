# Not Hotdog 🌭

**27 billion parameters. One calling in life.**

A deeply unserious, fully working photo classifier built with **TanStack Start**, **React**, **Cloudflare Workers**, **AI Gateway**, and **`@cf/cloudflare/clef`**.

## Run locally

Requires Node.js 24+ and a Cloudflare account with Workers AI access.

```sh
npm ci
npx cf auth login
npm run dev
```

Open **http://localhost:3000**. The app runs locally, but inference uses the **real remote Workers AI binding** and can incur Workers AI charges. There are no fake verdicts or fallback classifiers.

The `not-hotdog` AI Gateway has already been created in the account used during setup. Its request logging is disabled, and the application skips its cache. The site itself has **not** been deployed.

For a different account, create an equivalent gateway (or change `AI_GATEWAY_ID` in `cloudflare.config.ts`):

```sh
npx cf ai-gateway gateways create \
  --id not-hotdog \
  --cache-invalidate-on-update true \
  --cache-ttl 0 \
  --collect-logs false \
  --rate-limiting-interval 60 \
  --rate-limiting-limit 60 \
  --rate-limiting-technique sliding
```

Use `CLOUDFLARE_ACCOUNT_ID` to select an account if you have more than one. For CI, set `CLOUDFLARE_API_TOKEN` as a secret. No Cloudflare credentials are sent to the browser, and no API token is embedded in the code.

## What happens

1. Choose, drop, or capture a JPEG, PNG, or WebP image (up to 20 MiB).
2. The browser converts it to JPEG, caps each side at 1024 pixels, and removes original metadata by re-encoding.
3. A TanStack Start server route accepts the JPEG at `POST /api/classify`. It bounds the body to 2 MiB even without a Content-Length header, checks MIME type, JPEG frame dimensions, origin, and the per-IP rate limit.
4. The Worker calls CLEF with an embedded image and a typed `noul` (yes/no) question through the `not-hotdog` gateway.
5. CLEF's `answers.hotdog.noul` probability determines the verdict: **HOTDOG** at ≥ 0.5, otherwise **NOT HOTDOG**. The UI shows the probability of the selected outcome, not a claim of measured accuracy.

For this app, a hotdog is a sausage (including plant-based) **in a split bun**. A bare sausage, corn dog, banana, or actual dog doesn't qualify. Edit the criteria in `src/lib/classification.ts` if you disagree with the department's policy.

## Features

- Responsive mustard-and-ketchup design with an original SVG hotdog illustration.
- Drag-and-drop upload, native mobile camera capture, preview, and retry.
- Animated inspection and giant green/red verdicts.
- Clear failures and a 60-second client timeout; provider errors never become made-up classifications.
- Self-hosted fonts; no third-party frontend requests.
- Accessible labels, live status, keyboard focus styles, and reduced-motion support.
- No database, photo gallery, or application-level image storage.

## Privacy and abuse controls

Images are sent to Cloudflare for inference. The app does not persist them or log image bytes, IPs, or provider payloads. AI Gateway request logging is disabled on the gateway created during setup; if you use another gateway, review its logging settings. Worker logs contain only completion/failure events and latency. This is not a claim that no provider processing or retention occurs.

The Worker allows **10 submissions per IP per minute** through Cloudflare's rate-limit binding. The gateway is configured for **60 requests per minute**. These are abuse controls, **not a guaranteed global spend cap**. Origin checks help prevent browser cross-site submissions, but are not authentication and do not stop direct HTTP clients. For an unrestricted public launch, consider Turnstile and monitor/set an appropriate billing budget.

## Check and deploy

```sh
npm test
npm run build
npm run typecheck
npm run format:check
npx cf deploy --dry-run
npm run deploy
```

Run the build once before type-checking a fresh checkout to generate the TanStack route tree. Cloudflare binding types are generated from `cloudflare.config.ts`; don't hand-edit `.cloudflare/types/`.

Uses the **cf CLI** and **Cloudflare Vite plugin 2 beta** (pinned), not Wrangler. Build output is under `.cloudflare/output/v0/`. Production deployment is an explicit separate step.

## Project map

| File                         | Purpose                                             |
| ---------------------------- | --------------------------------------------------- |
| `src/routes/index.tsx`       | Upload, inspection state, and verdict UI            |
| `src/styles.css`             | Responsive styles and local fonts                   |
| `src/routes/api.classify.ts` | Workers bindings and AI Gateway integration         |
| `src/lib/classify.server.ts` | Bounded request handling and safe errors            |
| `src/lib/classification.ts`  | CLEF prompt, schema, JPEG validation                |
| `src/lib/image.ts`           | Browser-side resize and JPEG conversion             |
| `src/lib/classify.test.ts`   | 32 unit/handler tests with mocked inference         |
| `cloudflare.config.ts`       | Worker, AI binding, rate limiter, and observability |

Manual verification during setup: live hotdog and banana photos both classified correctly through AI Gateway; browser upload, result replacement, mobile layout, invalid requests, and accessibility checks exercised. Unit tests don't require Cloudflare credentials or paid inference.

Inspired by _Silicon Valley_. Unaffiliated. Not a food-safety tool.
