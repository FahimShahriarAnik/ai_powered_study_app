# CLAUDE.md

> Read this file first. Then read `docs/CONTEXT.md` and `docs/DEVELOPMENT_PLAN.md` before writing any code.

## Project: StudyAI (working name)

A web app that helps students study for exams using AI. Built for a student competition hosted by the Business Analytics department. Judged on functionality, creativity, and depth of AI integration.

## Non-Negotiable Rules

1. **Stability over features.** A working smaller app beats a broken larger one. If a feature risks breaking the build, cut it or simplify it.
2. **Incremental only.** Build one phase at a time. Do NOT write code for future phases until explicitly told.
3. **Always deployable.** After every step, the app must build cleanly and deploy to Vercel without errors.
4. **Commit checkpoints.** After each working step, tell the user exactly what to `git add` / `git commit -m "..."` so they can revert safely.
5. **Modular.** Isolated components. Server actions and API routes strictly separated from client UI.
6. **Type-safe.** TypeScript everywhere. Strict mode on. No `any` unless justified in a comment.
7. **UI consistency.** Tailwind CSS + shadcn/ui only.
8. **Free tier only.** No paid services. Supabase free tier, Vercel free tier, Gemini API via GCP credits.
9. **Ask before assuming.** If a phase requirement is ambiguous, ask one clarifying question before coding.

## UI Rules (Apply Everywhere)

- **Minimal & intuitive.** Don't pack screens. Whitespace > density.
- **Light + dark mode toggle** via `next-themes`. Default: system preference.
- **Contrast guarantee:** every piece of text must remain readable in BOTH themes. Use shadcn semantic tokens (`text-foreground`, `text-muted-foreground`, `bg-background`, `bg-card`, `border-border`) — never hardcoded colors like `text-white`, `bg-gray-900`, `text-black`. Verify both themes after every UI change.
- **No overflow.** Long content goes in: scrollable containers (`overflow-y-auto` + max-height), collapsible sections (shadcn `Collapsible` / `Accordion`), or dialogs/sheets. Never let content push layout out of viewport.
- **Responsive.** Must work on laptop demo screen; mobile is bonus, not blocker.
- **Loading + empty + error states** for every async UI. No silent failures.

## Workflow Per Phase

1. Confirm phase scope with user.
2. List files to be created/modified.
3. Write code.
4. Provide test instructions.
5. Provide commit command.
6. Wait for user confirmation before moving to next phase.

## Logging Rule

Do NOT update `docs/DEVELOPMENT_LOG.md` automatically. Only update it when the user explicitly says "update the log" or similar.

## Tech Stack (locked)

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui + `next-themes`
- **Backend/Auth/DB:** Supabase (Postgres + Auth + Realtime + Storage)
- **AI:** Vercel AI SDK + Google Gemini Flash via `@ai-sdk/google` (currently `gemini-3-flash-preview`, using $300 GCP credits)
- **Charts:** Recharts
- **Hosting:** Vercel
- **PDF parsing:** `pdf-parse` (Phase 3)

## Communication Style With User

- User prefers **brief responses by default** — bullets/tables, ~50 words.
- No preamble, no sign-offs, no "Great question!"
- User is a React dev, comfortable with frontend; expanding into backend/AI.
- When proposing architecture decisions, give 2-3 options with tradeoffs, not a lecture.
