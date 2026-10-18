# Next.js review reference

- App Router: server components by default; add `'use client'` only for interactivity (forms, charts, chat).
- Data goes through the typed API client (`web/src/lib/api.ts`) using `@ft/shared` schemas; no DB access from web.
- Auth: `middleware.ts` redirects unauthenticated users; the API stays the source of truth (401 → `/login`).
- Forms: client-side validation with the shared zod schema + server error display; submit disabled while pending.
- Accessibility: labels for inputs, semantic headings, sufficient contrast, keyboard navigable.
- No `dangerouslySetInnerHTML`; no secrets in `NEXT_PUBLIC_*` variables.
- Styling via Bootstrap classes + design tokens in `web/src/styles`; avoid inline styles.
- Prefer role / label queries in Playwright; add `data-testid` only when those are not enough.
