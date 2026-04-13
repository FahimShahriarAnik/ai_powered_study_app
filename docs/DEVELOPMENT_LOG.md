# DEVELOPMENT_LOG.md

> Append-only log of completed phases. **Only updated when the user explicitly requests it.** Never auto-update.

Entry format:
```
## [Date] — Phase N: Title
- What was built
- Files created/modified
- Decisions made (and why)
- Known issues / TODOs
- Commit: <hash or message>
```

---

## [2026-04-13] — Phase 1: Project Scaffold

- **What was built:** Next.js 15 app with TypeScript, Tailwind CSS, shadcn/ui, next-themes, Supabase client, Vercel AI SDK. Landing page with light/dark mode toggle.
- **Files created/modified:**
  - `app/layout.tsx` — root layout with ThemeProvider
  - `app/page.tsx` — landing page
  - `app/globals.css` — Tailwind + shadcn theme tokens
  - `components/theme-toggle.tsx` — light/dark toggle button
  - `lib/supabase.ts` — Supabase browser client
  - `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `components.json`
  - `docs/CONTEXT.md`, `docs/DEVELOPMENT_PLAN.md`
- **Decisions made:**
  - Used `next-themes` for theme management (SSR-safe, system default)
  - shadcn/ui semantic color tokens enforced to guarantee contrast in both themes
  - Supabase free tier for auth + DB
- **Known issues / TODOs:** None — clean build confirmed
- **Commit:** `46090c0` — "first phase built"
