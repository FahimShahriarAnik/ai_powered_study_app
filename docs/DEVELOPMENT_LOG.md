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
  - Dashboard "Quizzes taken" still hardcoded to 0 — wired in Phase 6.
  - No regeneration / "try again" UX — user must wait out the 60 s rate limit.
- **Commit:** `c8d1d1d` — "Phase 4 Quiz"

---

## [2026-04-13] — Phase 5: Quiz Taking + Sticky Notes + ELI5 + Results

- **What was built:** Full quiz-taking flow — one question at a time, answer selection, navigation (next/previous/dot-grid). Sticky notes panel (floating, collapsible, debounced auto-save). On submit: `quiz_attempts` + `answer_records` persisted via server actions. Results screen: score summary, per-topic breakdown (planned extension — see `docs/PHASE5_EXTENSIONS.md`), per-question correct/incorrect breakdown with explanations, ELI5 streaming via Gemini. Past attempts list (collapsible) inside QuizPreviewCard.
- **Files created:**
  - `app/(app)/courses/[id]/quiz/[quizId]/page.tsx` — server page; creates attempt row on load
  - `app/(app)/courses/[id]/quiz/[quizId]/quiz-runner.tsx` — client runner UI
  - `app/(app)/courses/[id]/quiz/[quizId]/results/[attemptId]/page.tsx` — results server page
  - `app/(app)/courses/[id]/quiz/[quizId]/results/[attemptId]/results-client.tsx` — results UI + ELI5
  - `components/quiz/sticky-notes-panel.tsx` — floating notes card
  - `lib/actions/attempts.ts` — server actions: `updateAttemptNotes`, `submitQuizAttempt`
  - `app/api/eli5/route.ts` — streaming Gemini ELI5 endpoint
- **Files modified:**
  - `types/database.ts` — added `quiz_attempts`, `answer_records` tables + `QuizWithAttempts` type
  - `components/quiz/quiz-preview-card.tsx` — added "Take Quiz" button + past attempts collapsible
  - `components/courses/material-card.tsx` — added `courseId` prop
  - `app/(app)/courses/[id]/page.tsx` — fetches completed attempts alongside quizzes
- **DB migration (run in Supabase):**
  - Created `quiz_attempts` (id, quiz_id, user_id, score, total, notes, completed_at, created_at) with RLS
  - Created `answer_records` (id, attempt_id, question_id, selected_index, is_correct, created_at) with RLS
- **Decisions made:**
  - Attempt created eagerly on page load (not on first answer). Abandoned attempts left as `completed_at = NULL`; the past-attempts UI filters to completed only. Acceptable orphan trade-off for simplicity.
  - ELI5 not persisted to DB — streamed on demand, cached in component state for toggle; matches plan.
  - Notes finalized at submit (server action receives final notes value) even though they are also debounce-saved during the quiz.
  - ELI5 env var required: `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local` and Vercel env settings.
- **Known issues / TODOs:** See `docs/PHASE5_EXTENSIONS.md` for planned enrichments (per-topic results breakdown, time tracking, confidence rating, retry-wrong-answers).
- **Commit:** pending

---

## [2026-04-13] — Phase 6: Strengths/Weaknesses Analytics

- **What was built:** `/analytics` page with topic accuracy bar chart, rolling accuracy line chart, topic×difficulty CSS-grid heatmap, and an AI-powered insights card (cached, refreshable). Dashboard Materials and Quizzes-taken stats wired to real DB counts. Analytics nav link added to sidebar.
- **Files created:**
  - `app/(app)/analytics/page.tsx` — server component, aggregates data, gates on 3+ completed attempts
  - `app/api/analytics/insights/route.ts` — auth + rate-limit (1/min) + Gemini `generateObject` + upsert into `ai_insights`
  - `lib/analytics/queries.ts` — `getUserAnalyticsData()`, single join fetching all analytics inputs
  - `lib/analytics/aggregations.ts` — `topicAccuracy()`, `rollingAccuracy()`, `topicDifficultyMatrix()`, `buildTopicSummaryForPrompt()`
  - `components/analytics/ai-insights-card.tsx` — client card with refresh button, staleness hint, disabled Phase 7 CTA with tooltip
  - `components/analytics/empty-state.tsx` — progress bar toward 3-attempt unlock
  - `components/analytics/topic-accuracy-chart.tsx` — Recharts BarChart, color-coded by performance tier
  - `components/analytics/rolling-accuracy-chart.tsx` — Recharts LineChart, last 10 attempts, 70% reference line
  - `components/analytics/topic-difficulty-heatmap.tsx` — CSS grid heatmap, no extra deps
  - `components/ui/tooltip.tsx` — shadcn tooltip (base-ui backed)
- **Files modified:**
  - `types/database.ts` — added `ai_insights` table typings + `AiInsight`, `AiInsightContent` exports
  - `lib/ai/schemas.ts` — added `analyticsInsightSchema` + `AnalyticsInsightSchema` type
  - `components/app-sidebar.tsx` — added Analytics nav link with `BarChart3` icon
  - `app/(app)/dashboard/page.tsx` — wired Materials and Quizzes-taken counts to real DB queries
  - `app/layout.tsx` — wrapped app in `TooltipProvider`
  - `package.json` / `package-lock.json` — added `recharts`
- **Autonomous decisions:**
  - **Heatmap as CSS `<table>`:** Recharts has no native heatmap; used Tailwind bg-opacity cells. Zero extra deps, theme-safe.
  - **AI insights cached in `ai_insights` table (unique per user):** Better demo UX — instant load, no Gemini call on every visit. Staleness badge shows after 3 new attempts since last refresh.
  - **No auto-regen on page load:** Regeneration always explicit (Refresh button click). Avoids unintended token spend.
  - **base-ui tooltip `render` prop instead of `asChild`:** shadcn tooltip now uses `@base-ui/react` not Radix; `asChild` not supported. Used `render={<span />}` on `TooltipTrigger` to avoid nested `<button>` HTML invalidity.
  - **Rolling window = 10 attempts:** Constant in `aggregations.ts` for easy tuning later.
  - **Topics with < 2 answers excluded from bar chart:** Prevents single-answer noise from skewing weakest-topic detection.
  - **Phase 7 CTA:** Disabled button with tooltip — UX story visible to judges without a broken click path.
  - **Dashboard stats short-circuit:** `.in("course_id", [])` is invalid; used `Promise.resolve({ count: 0 })` when `courseIds` is empty.
- **DB migration required (run in Supabase SQL editor before deploying):**
  ```sql
  create table ai_insights (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade unique,
    content jsonb not null,
    attempts_at_refresh int not null,
    updated_at timestamptz not null default now()
  );
  alter table ai_insights enable row level security;
  create policy "ai_insights_select_own" on ai_insights for select using (auth.uid() = user_id);
  create policy "ai_insights_insert_own" on ai_insights for insert with check (auth.uid() = user_id);
  create policy "ai_insights_update_own" on ai_insights for update using (auth.uid() = user_id);
  ```
- **Known issues / TODOs:** None — `npm run build` clean.
- **Branch:** `phase-6-analytics`
- **Commit:** `feat(phase-6): analytics dashboard with ai insights`

---

## [2026-04-13] — Phase 7: Adaptive Smart Quiz

- **What was built:** "Smart Quiz" feature that personalizes Gemini-generated MCQs based on the user's historical quiz performance. Targets 60% weak topics / 30% medium / 10% strong (harder difficulty on strong), with safe fallback to a balanced mix when the user hasn't completed enough attempts. Material-picker dialog on both Dashboard header and Analytics "Generate focused quiz on weak topic" CTA (Phase 6's disabled placeholder is now live).
- **Files created:**
  - `lib/analytics/user-stats.ts` — `getUserTopicStats()`, `bucketTopics()`, `planSmartQuiz()`, `buildSmartQuizPromptContext()`. Pure, unit-testable.
  - `app/api/generate-smart-quiz/route.ts` — auth check, material lookup, 60s/material rate limit, stats lookup, plan + prompt build, Gemini `generateObject` call with `quizSchema`, persistence into `quizzes` + `questions`.
  - `components/quiz/smart-quiz-dialog.tsx` — client dialog: loads user's materials, lets user pick one, POSTs to the API, navigates to the fresh quiz's runner page.
- **Files modified:**
  - `app/(app)/dashboard/page.tsx` — added `SmartQuizDialog` next to New Course in the header.
  - `components/analytics/ai-insights-card.tsx` — replaced the disabled Phase 7 tooltip/button with live `SmartQuizDialog` (variant="secondary").
  - `docs/BACKLOG.md` — appended Phase 7 autonomous-decisions table + Phase 7 TODOs for Phase 10 polish.
- **Autonomous decisions (see `docs/BACKLOG.md` for full table):**
  - **Source material is required:** Smart Quiz operates on one chosen material, not a cross-course synthesis. Cross-course would require RAG or multi-material blending, out of Phase 7 scope.
  - **Adaptation driven by prompt, not by algorithmic question selection:** We can't deterministically slice Gemini output. Instead we pass (a) student's weak/medium/strong topic lists with accuracies and (b) explicit per-bucket question counts as a *target distribution*. Gemini picks matching content from the material.
  - **Thresholds:** weak `< 50%`, strong `≥ 80%`, else medium. Minimum **5 answer records** before adaptation kicks in — below this, plan falls back to a balanced "mix easy/medium/hard" prompt (still via the Smart Quiz route; still labelled `adaptive`).
  - **Empty-bucket redistribution:** if any of weak/medium/strong is empty, that bucket's allocation rolls to the nearest populated bucket so the final plan still sums to `questionCount`.
  - **Rate limit:** 60s per material — reuses the Phase 4 signal (`quizzes.created_at`) instead of adding a separate table.
  - **`quizzes.difficulty = "adaptive"`** written on insert. `QuizPreviewCard`'s DIFF_COLORS map doesn't yet include `adaptive` so the badge falls through to the `mixed` blue — logged in BACKLOG for Phase 10 polish.
  - **Supabase join typing workaround:** A single `select("id, title, course_id, course:courses!…(name)")` call produced `never` types (because `Database.Tables.materials.Relationships: []` is empty). Replaced with two parallel queries joined client-side via a `Map<courseId, name>` — minimal change, zero schema retyping.
- **DB migrations:** None. Phase 7 is read-only on `answer_records` / `questions` and insert-only on `quizzes` / `questions` (already existing).
- **Known issues / TODOs:**
  - `adaptive` difficulty badge falls back to the `mixed` color — cosmetic only, noted in BACKLOG.
  - API returns `plan` object but UI doesn't surface it — would make a good demo-tell ("This quiz: 6 weak · 3 medium · 1 strong"). Logged in BACKLOG.
  - Analytics CTA still goes through the generic material picker rather than auto-selecting a material tied to the weakest topic — logged for Phase 10.
- **Verification:** `npm run build` clean (Turbopack Next.js 16). TypeScript strict clean. Dev server smoke test: `/analytics` 200, smart-quiz POST 401 without auth (correctly guarded).
- **Branch:** `phase-7-adaptive-quiz` (branched from `phase-6-analytics`)
- **Commit:** `feat(phase-7): adaptive smart quiz`
