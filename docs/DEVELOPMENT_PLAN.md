# DEVELOPMENT_PLAN.md

> Phases are sequential. Do NOT start a phase until the previous one is committed and confirmed working.

## Folder Structure (target)

```
/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/signup/page.tsx
│   ├── dashboard/page.tsx
│   ├── courses/[id]/page.tsx
│   ├── courses/[id]/quiz/[quizId]/page.tsx
│   ├── analytics/page.tsx
│   ├── api/
│   │   ├── generate-quiz/route.ts
│   │   ├── chat/route.ts
│   │   └── parse-pdf/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/              # shadcn primitives
│   ├── dashboard/
│   ├── quiz/
│   ├── analytics/
│   ├── upload/
│   └── theme-toggle.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── ai/
│   │   ├── gemini.ts
│   │   ├── prompts.ts
│   │   └── schemas.ts
│   ├── analytics/
│   └── utils.ts
├── types/
│   └── database.ts
├── docs/
│   ├── CONTEXT.md
│   ├── DEVELOPMENT_PLAN.md
│   └── DEVELOPMENT_LOG.md
├── CLAUDE.md
└── ...
```

## Phase 0 — Project Initialization

- `npx create-next-app@latest` (TS, Tailwind, App Router, ESLint).
- `npx shadcn@latest init`.
- Install `next-themes`. Set up theme provider in root layout.
- Add `ThemeToggle` component (light/dark/system) in nav.
- Verify both themes look correct on a dummy page.
- Push to GitHub. Connect Vercel. Confirm blank deploy works.
- **Commit:** `chore: init next.js + tailwind + shadcn + theme`

## Phase 1 — Foundation & Layout

- App shell: top nav (with theme toggle) + collapsible sidebar for course folders.
- Dashboard page with mock courses (no DB yet).
- Add shadcn components: button, card, dialog, input, sidebar, dropdown-menu.
- Verify scrollable behavior — sidebar long list scrolls, main content scrolls independently.
- Deploy to Vercel.
- **Commit:** `feat: app shell with mock dashboard`

## Phase 2 — Auth & Database

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

## Phase 3 — Material Upload & Storage

- Upload PDF or paste text into a course.
- **Limits:**
  - PDF: max 10 MB, max 50 pages (reject with clear error).
  - Pasted text: max 50,000 characters (~10K words).
  - Per course: max 10 materials (free tier guard).
- PDFs → Supabase Storage; text content extracted via `pdf-parse` in API route.
- `materials` table: `id, course_id, title, raw_text, file_url, char_count, created_at`.
- List materials inside course detail page (collapsible cards showing preview).
- **Commit:** `feat: material upload + pdf parsing with limits`

## Phase 4 — AI Quiz Generation (CORE)

- Server action: take material text → Gemini 2.0 Flash → structured JSON of MCQs.
- Use Vercel AI SDK `generateObject` with Zod schema: `{ question, options[4], correct_index, topic, difficulty (easy|medium|hard), explanation }`.
- Cap: 10 questions per generation, 1 generation per material per minute (rate limit).
- `quizzes` and `questions` tables.
- UI: "Generate Quiz" button per material → loading state → quiz preview (collapsible per question).
- **Commit:** `feat: ai mcq generation`

## Phase 5 — Quiz Taking & Results (CORE)

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

## Phase 6 — Strengths/Weaknesses Analytics (CORE)

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

## Phase 7 — Adaptive Difficulty (Going Beyond)

- "Smart Quiz" button on dashboard + analytics page.
- When generating, weight questions: 60% weak topics, 30% medium, 10% strong (harder difficulty on strong).
- Pull topic stats from `answer_records` aggregation.
- **Commit:** `feat: adaptive smart quiz`

## Phase 8 — AI Study Coach / RAG Chat (Going Beyond)

- Chat sheet (slide-in from right): ask questions about uploaded material.
- Embed materials with Gemini embeddings → store in `pgvector` (Supabase extension) → semantic search → Gemini with retrieved context.
- Stream responses via Vercel AI SDK `useChat`.
- Scoped per course (chat knows only that course's materials).
- **Commit:** `feat: rag study coach`

## Phase 9 — Collaborative / Competitive Quiz Rooms (Going Beyond, optional)

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
