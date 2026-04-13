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

## [2026-04-13] — Phase 0/1 (combined): Project Scaffold

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

---

## [2026-04-13] — Phase 1 (expanded): App Shell & Mock Dashboard

- **What was built:** Route-grouped layout under `app/(app)/` with top nav + collapsible sidebar, mock dashboard page, and a batch of shadcn primitives to back later phases.
- **Files created/modified:**
  - `app/(app)/layout.tsx` — app-shell layout (nav + sidebar + scrollable main)
  - `app/(app)/dashboard/page.tsx` — mock dashboard with course grid
  - `components/top-nav.tsx` — top nav with theme toggle
  - `components/app-sidebar.tsx` — collapsible sidebar
  - `components/ui/` — button, card, dialog, input, dropdown-menu, sheet, avatar, badge, scroll-area, separator
  - `app/page.tsx`, `app/layout.tsx` tweaked
- **Decisions made:**
  - Adopted `app/(app)/` segment group early so auth pages can slot into a sibling `(auth)/` group without layout bleed
  - Independent scroll for sidebar vs main content to enforce the "no overflow" UI rule
- **Known issues / TODOs:** Dashboard stats (materials, quizzes taken) are hardcoded — real counts deferred to post-Phase 4 polish
- **Commit:** `865a212` — "feat: app shell with mock dashboard (Cortex)"

---

## [2026-04-13] — Phase 2: Supabase Auth (email + guest) & Courses CRUD

- **What was built:** Email/password + anonymous guest auth, logout, real courses CRUD replacing mock data, RLS-enforced user isolation.
- **Files created/modified:**
  - `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`
  - `lib/supabase/client.ts`, `lib/supabase/server.ts` — SSR-safe Supabase clients
  - `proxy.ts` — session-refresh middleware
  - `types/database.ts` — typed schema (courses table)
  - `components/dashboard/new-course-dialog.tsx`
  - `app/(app)/dashboard/page.tsx` — wired to real `courses` table
  - `components/top-nav.tsx` — user dropdown + logout
  - `docs/BACKLOG.md` — new file for deferred items
- **Decisions made:**
  - **Google OAuth dropped** for this phase — needed a Google Cloud OAuth client ID/secret and wasn't blocking core flow. Tracked in `docs/BACKLOG.md`.
  - Used Supabase `@supabase/ssr` split (browser + server clients) instead of a single shared client to avoid Next 15 cookie-warning issues.
  - RLS policies on `courses` keyed by `auth.uid()` — guest users automatically isolated because anonymous auth issues a real uid.
- **Known issues / TODOs:** Guest → full-account conversion UI not built (low-priority)
- **Commit:** `010c1fe` — "feat(phase-2): supabase auth (email/guest) + courses crud"

---

## [2026-04-13] — Phase 3: Material Upload & PDF Parsing

- **What was built:** Course detail page with materials list, upload dialog supporting PDF + pasted text, server-side PDF parsing, enforced size/count limits, Supabase Storage integration.
- **Files created/modified:**
  - `app/(app)/courses/[id]/page.tsx` — course detail with materials list
  - `app/api/parse-pdf/route.ts` — server-side `pdf-parse` extraction
  - `components/courses/upload-material-dialog.tsx` — tabbed dialog (PDF / paste text)
  - `components/courses/material-card.tsx` — collapsible card with text preview
  - `components/ui/collapsible.tsx`, `components/ui/tabs.tsx`
  - `types/database.ts` — materials table
  - `app/(app)/layout.tsx`, `components/app-sidebar.tsx`, `components/top-nav.tsx` — minor fixes
- **Decisions made:**
  - Used `pdf-parse` v2's `PDFParse` class API (breaking change from v1).
  - Limits enforced server-side: 10 MB, 50 pages, 50k chars, 10 materials per course.
  - File input wrapped in a `<label>` because raw `<input type=file>` inside a Radix Dialog was swallowing clicks.
  - PDFs stored in a Supabase Storage `materials` bucket; extracted text persisted to `materials.raw_text` so AI calls don't re-parse.
- **Known issues / TODOs:** Very large pasted text (near 50k) can feel sluggish during insert — acceptable for demo.
- **Follow-up fix (`08782f8`):** Upload abortable on cancel; loading state resets when dialog closes mid-upload. Sidebar/top-nav small cleanups.
- **Commits:** `697adcd` — "feat(phase-3): material upload and pdf parsing with limits"; `08782f8` — "fix: abort upload on cancel + reset loading state on dialog close"

---

## [2026-04-13] — Phase 4: AI MCQ Generation

- **What was built:** Server-side quiz generation from material text → structured MCQs via Gemini → persisted quizzes and questions → collapsible preview UI per material.
- **Files created/modified:**
  - `app/api/generate-quiz/route.ts` — auth check, rate limit, Gemini call, persistence
  - `lib/ai/schemas.ts` — Zod `questionSchema` / `quizSchema`
  - `components/quiz/generate-quiz-button.tsx` — client button with loading + error states
  - `components/quiz/quiz-preview-card.tsx` — collapsible quiz with per-question reveal
  - `components/courses/material-card.tsx` — surfaces quizzes under each material
  - `app/(app)/courses/[id]/page.tsx` — fetches quizzes + questions for each material
  - `types/database.ts` — quizzes + questions tables
  - `package.json` — added `@ai-sdk/google`, `ai`, `zod`
- **Decisions made:**
  - **Model:** `gemini-3-flash-preview` via `@ai-sdk/google` (newer than the plan's `gemini-2.0-flash`; plan + CLAUDE.md updated to reflect).
  - Used Vercel AI SDK `generateObject` with Zod schema for guaranteed shape — no brittle JSON parsing.
  - Prompt inlined in the route rather than split into `lib/ai/prompts.ts` — only one caller, extraction was premature.
  - **Rate limit:** 1 generation per material per 60 s (checked against latest quiz row `created_at`). No cross-material limit.
  - Raw text truncated to 15k chars before sending to keep token usage bounded.
  - Questions stored with a `position` column so UI ordering is deterministic on reload.
- **Known issues / TODOs:**
  - Dashboard "Quizzes taken" still hardcoded to 0 — real counter lands with Phase 5 attempts or Phase 10 polish.
  - No regeneration / "try again" UX — user must wait out the 60 s rate limit.
- **Commit:** `c8d1d1d` — "Phase 4 Quiz"
