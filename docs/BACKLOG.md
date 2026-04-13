# Backlog

Deferred features and known TODOs across phases.

---

## Auth

- [ ] **Google OAuth** — Enable in Supabase: Authentication → Providers → Google. Needs Google Cloud OAuth client ID + secret. Skipped in Phase 2 to unblock core auth.

---

## Future Phases

_(populated as phases progress)_

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
