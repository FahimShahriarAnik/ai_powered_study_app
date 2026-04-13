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

## Phase 7 — Known TODOs / Polish items (defer to Phase 10)

- [ ] **`"adaptive"` difficulty badge color** — `QuizPreviewCard` DIFF_COLORS map doesn't include `adaptive`; it falls through to the `mixed` blue. Add a distinct color (e.g. violet) to visually signal Smart-Quiz-authored quizzes.
- [ ] **Surface the weak/medium/strong plan in UI** — The API returns `plan: { weakCount, mediumCount, strongCount, fallback }` but the UI doesn't show it. Could render a tiny pill in the dialog after generation ("This quiz: 6 weak · 3 medium · 1 strong"). Good demo-tell for judges.
- [ ] **Analytics-page "jump to weakest topic"** — The CTA in the insights card is material-picker based. A nicer flow would pre-filter materials to those whose past questions hit the user's weakest topic. Requires extra query (quiz → material) joined on questions.topic.
- [ ] **Different rate-limit for Smart Quiz** — Currently shares the 60s/material quiz rate limit. Consider a per-user global rate limit (e.g. 1 smart quiz / 2 min) since Smart Quiz costs more tokens than a regular quiz.
- [ ] **User-controlled weak/medium/strong mix** — Let the user adjust the 60/30/10 distribution in the Smart Quiz dialog (e.g. three sliders or a simple preset selector: "Focus weak", "Balanced", "Challenge me"). Current split is hardcoded in `lib/analytics/user-stats.ts` `planSmartQuiz()`. Pass the chosen counts through the API body and thread them through `planSmartQuiz` / `buildSmartQuizPromptContext`. UX note: sliders should be constrained to sum = `questionCount` and each bucket should have a minimum of 0.

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

---

## Phase 7 — Autonomous Decisions Log

| Decision | Rationale |
|---|---|
| Smart Quiz requires a source **material** (not cross-course synthesis) | Gemini generates from provided material text; cross-course synthesis would need RAG or multi-material blending, out of scope. Material picker keeps architecture aligned with Phase 4. |
| Adaptive targets expressed in prompt, not enforced algorithmically | We can't deterministically control Gemini question distribution, but we *can* instruct it precisely. Plan spec (60/30/10) passed as explicit targets + student's weak/medium/strong topic lists. Gemini picks matching content from the material. |
| Thresholds: weak < 50%, strong ≥ 80%, else medium | Readable boundaries. Tunable via constants in `lib/analytics/user-stats.ts`. |
| Minimum 5 answer records before adaptation kicks in | Avoids overfitting on 1–2 data points. Below threshold → falls back to a balanced mix (same prompt contract as Phase 4, but using the new route). |
| Redistribution logic when a bucket is empty | If user has no weak topics yet, weak% rolls to medium; if no strong, rolls to medium too. Prevents zero-question plans and keeps question count accurate. |
| Same 60s/material rate limit as Phase 4 | Consistent UX. Shares the `quizzes.created_at` signal; no separate rate-limit table. |
| Stored as `quizzes.difficulty = "adaptive"` | New badge value. Added `adaptive` color in QuizPreviewCard for visual differentiation (see note below). |
| Smart Quiz button lives in dashboard header + analytics insights card | Dashboard = always-visible entry; analytics card fulfills Phase 6's "Generate focused quiz on weak topic" CTA (previously disabled). |
| Analytics CTA opens the same dialog (not a zero-click jump) | The Phase 6 CTA promised "focused quiz on weak topic" — but we still need the user to pick a material. Dialog reuses the same material picker for consistency. |
| `SmartQuizDialog` fetches materials+courses via two separate queries, joined client-side | Supabase's typed join inference produced `never` because `Database.Tables.materials.Relationships: []` is empty. Rather than retyping the whole schema, a second tiny query + Map join is the minimal fix. |
| No new DB tables or migrations | Phase 7 is purely read-side on `answer_records`/`questions` + reuse of `quizzes`/`questions` insert. Zero schema change. |
| `"adaptive"` difficulty badge color not added to `QuizPreviewCard` DIFF_COLORS map | Falls through to the `mixed` blue color — acceptable for demo; open TODO listed below. |
