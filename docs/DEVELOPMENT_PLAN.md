# DEVELOPMENT_PLAN.md

> Phases are sequential. Do NOT start a phase until the previous one is committed and confirmed working.

## Current Status (as of 2026-04-13)

| Phase | Status | Commit |
|---|---|---|
| 0 — Project Init | Done | `46090c0` |
| 1 — Foundation & Layout | Done | `865a212` |
| 2 — Auth & DB (email + guest) | Done | `010c1fe` |
| 3 — Material Upload | Done | `697adcd` (+ `08782f8` fix) |
| 4 — AI Quiz Generation | Done | `c8d1d1d` |
| 5 — Quiz Taking & Results | Done | (phase-5 branch) |
| 6 — Analytics | Done | (phase-6-analytics branch) |
| 7 — Adaptive Smart Quiz | Done | (phase-7-adaptive-quiz branch) |
| 8 — RAG Study Coach | Done | (phase-8-rag-study-coach branch) |
| 9 — Collaborative Quiz Rooms | Done | (phase-9-realtime-quiz-rooms branch) |
| 10 — Polish & Demo Prep | Pending | — |

**Deviations from original plan (carry forward):**
- **Phase 2:** shipped email + guest only. Google OAuth dropped (not required for demo; revisit if time permits).
- **Phase 4:** model in use is `gemini-3-flash-preview` via `@ai-sdk/google`, not Gemini 2.0 Flash. Prompt is inlined in `app/api/generate-quiz/route.ts` — `lib/ai/prompts.ts` and `lib/ai/gemini.ts` were never created (unnecessary indirection at this scale).
- Route grouping uses `app/(app)/` and `app/(auth)/` segment groups — differs from the flat tree originally sketched below but functionally equivalent.
- Dashboard stats card shows hardcoded `0` for Materials and Quizzes — **wired in Phase 6**.

## Folder Structure (actual, as of Phase 7)

```
/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── analytics/page.tsx                  # Phase 6
│   │   ├── dashboard/page.tsx
│   │   └── courses/[id]/
│   │       ├── page.tsx
│   │       └── quiz/[quizId]/
│   │           ├── page.tsx                    # Phase 5
│   │           ├── quiz-runner.tsx             # Phase 5
│   │           └── results/[attemptId]/        # Phase 5
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── api/
│   │   ├── analytics/insights/route.ts         # Phase 6
│   │   ├── eli5/route.ts                       # Phase 5
│   │   ├── generate-quiz/route.ts
│   │   ├── generate-smart-quiz/route.ts        # Phase 7
│   │   └── parse-pdf/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/                        # shadcn primitives (+ tooltip Phase 6)
│   ├── analytics/                              # Phase 6
│   │   ├── ai-insights-card.tsx
│   │   ├── empty-state.tsx
│   │   ├── rolling-accuracy-chart.tsx
│   │   ├── topic-accuracy-chart.tsx
│   │   └── topic-difficulty-heatmap.tsx
│   ├── dashboard/new-course-dialog.tsx
│   ├── courses/
│   │   ├── material-card.tsx
│   │   └── upload-material-dialog.tsx
│   ├── quiz/
│   │   ├── generate-quiz-button.tsx
│   │   ├── quiz-preview-card.tsx
│   │   ├── smart-quiz-dialog.tsx              # Phase 7
│   │   └── sticky-notes-panel.tsx             # Phase 5
│   ├── chat/
│   │   └── course-chat-sheet.tsx              # Phase 8 — RAG chat UI
│   ├── rooms/
│   │   ├── page.tsx                           # Phase 9 — create/join hub (server)
│   │   ├── rooms-hub.tsx                      # Phase 9 — create/join client UI
│   │   └── [roomId]/
│   │       ├── page.tsx                       # Phase 9 — room server page
│   │       └── room-client.tsx                # Phase 9 — live game UI (Realtime)
│   ├── app-sidebar.tsx
│   ├── top-nav.tsx
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── lib/
│   ├── analytics/                             # Phase 6 (+ Phase 7)
│   │   ├── aggregations.ts
│   │   ├── queries.ts
│   │   └── user-stats.ts                      # Phase 7 — weak/medium/strong buckets + planner
│   ├── rag/
│   │   └── chunker.ts                         # Phase 8 — text chunking for embeddings
│   ├── actions/attempts.ts                    # Phase 5
│   ├── supabase/{client,server}.ts
│   ├── ai/schemas.ts
│   └── utils.ts
├── types/database.ts
├── docs/
│   ├── CONTEXT.md
│   ├── DEVELOPMENT_PLAN.md
│   └── DEVELOPMENT_LOG.md
├── CLAUDE.md
└── ...
```

## Folder Structure — Additions expected in later phases

```
lib/supabase/middleware.ts                      # if server auth middleware needed
```

## Phase 0 — Project Initialization  [DONE — commit `46090c0`]

- `npx create-next-app@latest` (TS, Tailwind, App Router, ESLint).
- `npx shadcn@latest init`.
- Install `next-themes`. Set up theme provider in root layout.
- Add `ThemeToggle` component (light/dark/system) in nav.
- Verify both themes look correct on a dummy page.
- Push to GitHub. Connect Vercel. Confirm blank deploy works.
- **Commit:** `chore: init next.js + tailwind + shadcn + theme`

## Phase 1 — Foundation & Layout  [DONE — commit `865a212`]

- App shell: top nav (with theme toggle) + collapsible sidebar for course folders.
- Dashboard page with mock courses (no DB yet).
- Add shadcn components: button, card, dialog, input, sidebar, dropdown-menu.
- Verify scrollable behavior — sidebar long list scrolls, main content scrolls independently.
- Deploy to Vercel.
- **Commit:** `feat: app shell with mock dashboard`

## Phase 2 — Auth & Database  [DONE — commit `010c1fe` (Google OAuth dropped)]

- Supabase project setup. Add env vars to Vercel.
- Schema: `users` (managed by Supabase Auth), `courses`, `materials`.
- Auth pages:
  - **Email/password** signup + login
  - **Google OAuth** button
  - **Guest login** (Supabase anonymous auth) — single click, creates ephemeral user, can convert to full account later
- Logout from user dropdown in nav.
- Replace mock data with real `courses` CRUD.
- Row Level Security (RLS) policies on every table — guest users isolated.
- **Commit:** `feat: supabase auth (email/google/guest) + courses crud`

## Phase 3 — Material Upload & Storage  [DONE — commits `697adcd`, `08782f8`]

- Upload PDF or paste text into a course.
- **Limits:**
  - PDF: max 10 MB, max 50 pages (reject with clear error).
  - Pasted text: max 50,000 characters (~10K words).
  - Per course: max 10 materials (free tier guard).
- PDFs → Supabase Storage; text content extracted via `pdf-parse` in API route.
- `materials` table: `id, course_id, title, raw_text, file_url, char_count, created_at`.
- List materials inside course detail page (collapsible cards showing preview).
- **Commit:** `feat: material upload + pdf parsing with limits`

## Phase 4 — AI Quiz Generation (CORE)  [DONE — commit `c8d1d1d`]

- Server action: take material text → Gemini 2.0 Flash → structured JSON of MCQs.
- Use Vercel AI SDK `generateObject` with Zod schema: `{ question, options[4], correct_index, topic, difficulty (easy|medium|hard), explanation }`.
- Cap: 10 questions per generation, 1 generation per material per minute (rate limit).
- `quizzes` and `questions` tables.
- UI: "Generate Quiz" button per material → loading state → quiz preview (collapsible per question).
- **Commit:** `feat: ai mcq generation`

## Phase 5 — Quiz Taking & Results (CORE)  [DONE — commits pending]

- Quiz UI: one question at a time, select answer, next.
- **Sticky notes panel:** floating note card top-right (collapsible to icon). Free-text. Auto-saves to `quiz_attempts.notes` on every keystroke (debounced 500ms).
- On submit: save `quiz_attempts` (with notes) + per-question `answer_records`.
- Results screen:
  - Score, correct/incorrect breakdown
  - Per-question explanations (collapsible)
  - **ELI5 button** on each explanation: streams a simplified analogy-based version via Gemini. Toggle, no DB save.
  - **Notes display:** show saved notes from the attempt
- Past attempts list per material with notes preserved.
- **Commit:** `feat: quiz taking + sticky notes + eli5 + results`
- **Extensions backlog:** `docs/PHASE5_EXTENSIONS.md` — per-topic results breakdown, time tracking, confidence rating, retry-wrong-answers.

## Phase 6 — Strengths/Weaknesses Analytics (CORE)  [NEXT]

- `/analytics` page: per-topic mastery scores, trends over time.
- **Trigger logic:** insights surface after **3+ completed quizzes** (not weekly). Empty state before that: "Take 3 quizzes to unlock insights."
- Recharts:
  - Bar chart: topic accuracy %
  - Line chart: rolling accuracy over last N attempts
  - Heatmap: topic × difficulty performance
- AI-generated insight (refreshed on demand + after every 3rd new attempt):
  - "Weakest topic: X — accuracy Y%. Try a focused quiz."
  - "Strongest: Z. Consider harder difficulty."
  - One-click button: "Generate focused quiz on weak topic" (jumps into Phase 7).
- **Commit:** `feat: analytics dashboard with ai insights`

## Phase 7 — Adaptive Difficulty (Going Beyond)  [DONE — phase-7-adaptive-quiz branch]

- "Smart Quiz" button on dashboard + analytics page (analytics CTA reuses the same dialog).
- Topic stats pulled from `answer_records` + `questions` via `lib/analytics/user-stats.ts`.
- Buckets: weak `< 50%`, strong `≥ 80%`, else medium. Min 5 answers before adaptation; below → balanced fallback.
- Target distribution (60/30/10) + weak topic list passed as prompt context to Gemini; Gemini selects matching content from the chosen material.
- New API route: `app/api/generate-smart-quiz/route.ts`. Reuses `quizSchema`; `quizzes.difficulty = "adaptive"`.
- No DB migrations required.
- **Commit:** `feat: adaptive smart quiz`

## Phase 8 — AI Study Coach / RAG Chat (Going Beyond)

- Chat sheet (slide-in from right): ask questions about uploaded material.
- Embed materials with Gemini embeddings → store in `pgvector` (Supabase extension) → semantic search → Gemini with retrieved context.
- Stream responses via Vercel AI SDK `useChat`.
- Scoped per course (chat knows only that course's materials).
- **Commit:** `feat: rag study coach`

## Phase 9 — Collaborative / Competitive Quiz Rooms (Going Beyond, optional)  [DONE — phase-9-realtime-quiz-rooms branch]

> **Riskiest phase. Build LAST. Have a fallback.**

- **Fallback first:** Co-op mode — both users see same questions, no race, shared score. If competitive breaks, ship this.
- **Competitive mode (stretch):**
  - Server-authoritative: timestamps assigned by Postgres on insert, not client.
  - First-write-wins on answer lock: `UPDATE answer_records SET answer = X WHERE question_id = Y AND answer IS NULL`.
  - Don't ship `correct_index` to client until question closes.
  - 30s timeout per question; auto-forfeit on disconnect.
  - Live presence + score via Supabase Realtime channels.
- Demo plan: two browser windows on same machine with pre-seeded test accounts.
- **Commit:** `feat: collaborative quiz rooms`

## Phase 10 — Polish & Demo Prep

- Audit every page in BOTH themes — no invisible text, no overflow, no broken layouts.
- Loading skeletons, error states, empty states everywhere.
- Onboarding flow for first-time users.
- Seed demo account with sample course + materials + quiz attempts so analytics page is populated for judges.
- README with screenshots + demo video link.
- **Commit:** `chore: demo polish`

## Phase Decision Points

After Phase 6, reassess time remaining. Priority order for "Going Beyond":
1. **Adaptive difficulty (Phase 7)** — highest ROI, builds on existing data, low risk.
2. **RAG study coach (Phase 8)** — most impressive AI demo, medium risk.
3. **Collaborative rooms (Phase 9)** — flashy but riskiest. Co-op fallback if competitive breaks.

Drop phases ruthlessly if behind schedule. **A polished 6-phase app beats a broken 9-phase app.**
