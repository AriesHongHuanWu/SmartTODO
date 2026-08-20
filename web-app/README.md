# SmartTODO web app

The Next.js half of SmartTODO: the task dashboard, the month calendar, account settings, the extension download page, and the `/api/analyze` endpoint the browser extension posts chat batches to.

See the [repository README](../README.md) for the full architecture and the extension side.

```bash
npm install --legacy-peer-deps
npm run dev          # http://localhost:3000
```

`/api/analyze` requires `GEMINI_API_KEY` in the environment. `npm run pages:build` rebuilds and zips the extension into `public/extension.zip`, then runs `@cloudflare/next-on-pages`.
