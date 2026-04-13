# Backlog

Deferred features and known TODOs across phases.

---

## Auth

- [ ] **Google OAuth** — Enable in Supabase: Authentication → Providers → Google. Needs Google Cloud OAuth client ID + secret. Skipped in Phase 2 to unblock core auth.

---

## Future Phases

_(populated as phases progress)_

---

## Phase 6 — Analytics UI Issues (fix in Phase 10 polish)

- [ ] **Topic accuracy chart — Y-axis label overlap** — topic names overlap when there are many topics. Fix: increase chart height dynamically based on topic count, or truncate + tooltip on hover.
- [ ] **Rolling accuracy chart — no connecting line** — dots render but the line between them is missing. Likely a Recharts `type="monotone"` or data shape issue. Investigate `connectNulls` prop.
- [ ] **Heatmap/bar chart scale** — currently aggregates ALL answer_records ever (e.g. 20 questions × 2 quizzes = 20 data points). With 100+ questions across 10 quizzes this could get noisy. Consider: cap to last N attempts, or deduplicate by question_id keeping only most recent answer per question.
- [ ] **Dark mode — analytics text invisible** — some text/chart elements lose contrast in dark theme. Audit chart axis tick colors and card text tokens; ensure all use semantic tokens (`text-foreground`, `text-muted-foreground`) not hardcoded colors.

---

## Dashboard — Known TODOs

- [ ] **Course card material/quiz counts** — The per-course card in the dashboard grid shows hardcoded "0 materials · 0 quizzes". Needs a join on `materials` and `quizzes` per course_id. Defer to Phase 10 polish.

---

## Phase 6 — Autonomous Decisions Log

| Decision | Rationale |
|---|---|
| Heatmap as CSS `<table>` (not Recharts) | Recharts has no heatmap primitive; CSS approach is zero-dep and theme-safe |
| AI insights cached in `ai_insights` table (unique per user) | Instant analytics page load; no Gemini call on every visit; demo-friendly |
| Staleness shown after 3 new attempts; regeneration is always explicit | Prevents token waste on auto-regen; user controls when to refresh |
| base-ui `render={<span />}` instead of Radix `asChild` on TooltipTrigger | shadcn now ships tooltip via `@base-ui/react`; `asChild` not supported in that API |
| Phase 7 CTA rendered as disabled button with tooltip | Keeps UX story intact for judges without a broken click path |
| Topics with < 2 answers excluded from bar chart | Avoids single-answer noise skewing weakest-topic result |
| Dashboard stats short-circuit when no courses | `.in("course_id", [])` is invalid Postgres; `Promise.resolve({ count: 0 })` used instead |
| Rolling window = 10 attempts (constant in aggregations.ts) | Matches plan spec; easy to tune later |
