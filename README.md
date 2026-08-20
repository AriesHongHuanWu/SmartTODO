# SmartTODO

A Chrome extension that reads the chat tab you already have open, extracts the commitments buried in it, and syncs them to a web task list.

Most of my actual todos arrive as messages: "can you send that by Friday", "let's meet Tuesday at 3". They never make it into a task app because retyping them is friction. SmartTODO removes the retyping step. A content script watches the DOM of chat sites you allow, buffers newly seen messages, and once the buffer crosses a threshold sends the batch to a language model that returns structured tasks. Those land in Firestore and appear in the web dashboard and calendar in real time.

Web app: **https://smarttodo.pages.dev**

## Repository layout

```
extension/     Chrome MV3 extension (TypeScript, built by Vite)
web-app/       Next.js 16 app: dashboard, calendar, settings, and the /api/analyze endpoint
```

The two halves share one Firebase project, so the extension writes and the web app reads the same `todos` collection.

## How it works

### 1. Scraping and buffering: `extension/src/content.ts`

A `setInterval` fires every 3 seconds and, only on hostnames present in the user's site list, queries a set of message selectors (`div[dir="auto"]`, `span[dir="ltr"]`, `.message-in`, `.message-out`, `.c-message__body`). For each hit it walks up to four ancestors looking for a `data-tooltip-content` timestamp, or scans sibling spans inside the enclosing `[role="row"]`, and prefixes the message with whatever timestamp it finds.

Deduplication uses a 32-bit rolling string hash (`hash = (hash << 5) - hash + charCode`). Hashes live in a `Set` that is cut back to its newest 1,000 entries once it passes 2,000, with the newest 500 persisted to `chrome.storage.local`, so the same visible message is not re-sent after a scroll or a page navigation.

The buffer flushes in one of two modes, chosen in the popup:

| Mode | Flush trigger |
|---|---|
| `buffer` | total characters in the buffer reach `bufferSize` (default 3,000) |
| `message` | number of buffered messages reaches `messageThreshold` (default 10) |

When the on-device model is selected, both thresholds are clamped down (800 characters, 5 messages) because Gemini Nano's context is far smaller than the cloud model's.

A separate regex runs locally on every new message and costs nothing:

```js
/([今明後]天|禮拜[一二三四五六日天]|星期[一二三四五六日天]|下週|下星期|早上|下午|晚上|\d{1,2}點|\d{1,2}:\d{2}|today|tomorrow|monday|...)/i
```

A match triggers a `check_schedule` message to the service worker, which counts the user's pending dated tasks and shows an in-page toast. This is a heuristic nudge, not extraction.

The content script also renders its own UI directly into the host page: a progress pill showing buffer fill, and a hover-to-expand toast, both at `z-index: 2147483647` with no injected stylesheet.

### 2. Routing and AI: `extension/src/background.ts`

The MV3 service worker decides where a flushed batch goes.

**Cloud path (default).** `processChatLogs` first reads the user's existing pending tasks out of Firestore and sends them along with the batch to `POST /api/analyze`, so the model can return an `update` action against an existing task instead of creating a duplicate when a meeting gets moved.

**On-device path.** With "local AI" enabled, `handleNanoMapReduce` probes for Chrome's built-in model across every location the API has lived at (`self.ai`, `self.model`, `chrome.ai`, `chrome.aiOriginTrial`, `self.chrome.ai`), then for `languageModel` / `assistant` on whichever it finds. If nothing is there, or `capabilities().available === 'no'`, it falls back to the cloud path rather than failing. Because Nano cannot hold a long conversation, extraction is a map-reduce: each flush is one map step producing a JSON array, results accumulate in `nanoPendingTasks`, and after 5 chunks a second Nano session is created purely to deduplicate and merge them before the write. Download progress for the ~2 GB model is surfaced through the same toast channel.

Both paths converge on `syncToFirestore`, which either `addDoc`s a new todo or, for `action: 'update'`, finds the pending doc whose title matches `targetTitle` and updates it.

Firebase auth in a service worker needs `initializeAuth(app, { persistence: indexedDBLocalPersistence })` rather than `getAuth()`, which loses its session there. Sessions can also be handed over from the web app: `chrome.runtime.onMessageExternal` accepts a custom token from the origins listed in `externally_connectable` and calls `signInWithCustomToken`.

### 3. Extraction endpoint: `web-app/src/app/api/analyze/route.ts`

An edge runtime route (`export const runtime = 'edge'`) holding the server-side `GEMINI_API_KEY`. It builds a prompt containing the current timestamp, the existing pending tasks, and the chat batch, and constrains the model to a fixed schema: `action` (`create` or `update`), `targetTitle`, `title`, `context`, `category` (one of work, personal, shopping, meeting, homework, general), ISO-8601 `dueDate` or null, plus `threadUrl` and `siteName` so every task deep-links back to the conversation it came from. Retries are limited to 503, 429 and "Service Unavailable" responses, with 1s/2s/4s exponential backoff, and the error text is rewritten into something a user can act on.

### 4. Web app

`web-app/src/app/dashboard/page.tsx` subscribes with `onSnapshot` to the caller's own todos, sorts them client-side, and groups pending items into overdue and dated buckets. It also supports adding tasks by hand, toggling status and deleting. `calendar/page.tsx` renders a month grid built from `new Date(year, month, 1).getDay()` padding and buckets tasks by date key. `settings/page.tsx` shows the task count and can bulk-delete everything for the signed-in user. The `download-extension` route serves `public/extension.zip`, which `scripts/zip-extension.js` produces from `extension/dist` with archiver.

## Tech stack

| Part | What is actually used |
|---|---|
| Extension | TypeScript, Vite 5, Chrome Manifest V3, `firebase` (auth + firestore) |
| On-device AI | Chrome built-in Gemini Nano, via the `ai.languageModel` `capabilities()` / `create()` / `prompt()` session API |
| Web app | Next.js 16, React 19, Tailwind CSS 4, lucide-react |
| Cloud AI | `@google/generative-ai`, `gemini-3.1-flash-lite-preview`, on the edge runtime |
| Data | Firebase Auth and Firestore (`todos` collection) |
| Deploy | Cloudflare Pages via `@cloudflare/next-on-pages` |

## Getting started

Build the extension:

```bash
cd extension
npm install
npm run build          # outputs extension/dist
```

Then load it: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `extension/dist`. Open the popup, sign in with an email and password, add the hostnames you want watched, and turn on auto-sync.

Run the web app:

```bash
cd web-app
npm install --legacy-peer-deps
npm run dev            # http://localhost:3000
```

The web app needs `GEMINI_API_KEY` in the environment for `/api/analyze`. The Firebase client config is currently hardcoded in `web-app/src/lib/firebase.ts` and `extension/src/firebase.ts`; point both at your own project to run this end to end.

To produce a Cloudflare Pages build, including a freshly zipped extension:

```bash
cd web-app
npm run pages:build
```

## Status and limitations

A personal prototype, built over four days in May 2026 (65 commits). It works, but it is a demonstration of the pipeline rather than a product, and it was never published to the Chrome Web Store.

Honest constraints:

- **The extension reads the content of your chats.** It holds `<all_urls>` host permissions and only self-limits to the site list in its settings. Message text leaves the browser on the cloud path. Do not install it on an account you do not control.
- **`/api/analyze` does not authenticate the caller.** It requires a `userId` in the body but never verifies it, and CORS is `*`. Anyone who knows the URL can spend the server's model quota. Fixing this means verifying a Firebase ID token in the route.
- **DOM scraping is inherently fragile.** The selectors are generic enough to catch several chat products, which also means they catch non-message text on the same page. A layout change on any target site can break extraction with no test to catch it.
- **The Nano path is best-effort.** The API surface for Chrome's built-in model moved repeatedly during development, which is why detection probes five different globals. Availability depends on the browser channel, flags and hardware, so the cloud fallback carries most real use.
- **No automated tests, no CI, no error reporting.**
- The web app's landing page claims automatic completion detection. The extraction schema only supports `create` and `update`; nothing in the code moves a task to completed on its own.
- Firestore security rules are not in this repository. Deploying your own copy means writing them, or every signed-in user can read every todo.
- The root `package.json` build script references a `scripts/` directory that only exists under `web-app/`, so build from `web-app/` rather than the repository root.

## License

MIT. See [LICENSE](LICENSE).
