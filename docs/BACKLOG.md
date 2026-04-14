# Backlog

Deferred features and known TODOs across phases.

---

## Pre-Phase-10 Polish (completed fixes)

- [x] **PDF upload — Vercel 10s timeout** — Added `maxDuration = 60` to `parse-pdf` route. (`3de8355`)
- [x] **PDF upload — slow file transfer through Vercel** — Refactored to two-phase: client uploads directly to Supabase Storage, API route reads from storage and parses. (`3de8355`)
- [x] **PDF upload — cancel state bug** — `cancelledRef` + `handleClose` abort in-flight requests and fire-and-forget cleanup of orphaned storage files; re-opening modal always shows blank form. (`3de8355`)
- [x] **PDF upload — no progress feedback** — Two-phase progress indicator: "Step 1 of 2 · Sending to storage" → "Step 2 of 2 · Reading PDF content". (`3de8355`)
- [x] **PDF upload — UI** — Smaller tab triggers, inline field validation (title / file errors shown under each field), file type enforcement, tinted error banners. (`3de8355`)
- [x] **Landing page — too minimal** — Full redesign: sticky nav with anchor links, hero with stat strip, 6-feature grid, how-it-works steps, CTA banner, footer. (`b66e87f`)
- [x] **Landing page — CTA unaware of auth state** — "Get started free" → "Go to Dashboard" when logged in (server-side check, no flash). (`b66e87f`)
- [x] **Nav — "Cortex" not clickable** — Sidebar and top-nav "Cortex" titles are now `<Link href="/">` with `cursor-pointer`. (`b66e87f`)
- [x] **Nav — duplicate "Cortex" title on desktop** — Removed sidebar "Cortex" title; top-nav title is the single source across all viewports. (`b66e87f`)
- [x] **Reader / accessible theme** — New `.reader` CSS class: warm sepia background, deep forest green primary, amber accent. Replaces system theme in the toggle cycle (light → dark → reader). (`6b67281`)
- [x] **Cursor not pointer on interactive elements** — Global CSS rule covers `button`, `a`, `[role=button]`, `label[for]`, `select`, `summary`, `[tabindex]`; disabled elements get `not-allowed`. (`6b67281`)
- [x] **Icons too small** — Sidebar nav icons and theme toggle bumped from `h-4` to `h-5`; mobile hamburger from `h-5` to `h-6`. (`6b67281`)
- [x] **Landing feature cards not clickable** — Wrapped in `<Link>`; logged-in → specific page, logged-out → `/login`. Feature titles rewritten for general audience. (`3285241`)
- [x] **Primary buttons hard to spot** — "Chat with AI" and "Generate Quiz" changed to filled primary + shadow; "Add Material" demoted to outline for clear hierarchy. (`2e2a805`)
- [x] **UI too sparse / excessive negative space** — Sidebar nav `h-9→h-11`, `text-sm→text-base font-medium`; stat cards `p-4→p-6`, values `text-2xl→text-4xl font-bold`; course cards larger title/date; material card padding and text bumped throughout; all primary CTA buttons promoted from `size=sm` to default. (pending push)

---

## Auth

- [ ] **Google OAuth** — Enable in Supabase: Authentication → Providers → Google. Needs Google Cloud OAuth client ID + secret. Skipped in Phase 2 to unblock core auth.

---

## Future Phases

_(populated as phases progress)_

---

## Phase 10 — Feature Additions (2026-04-14)

- [x] **Confidence self-rating** — Optional 🤔/🤷/💡 buttons in quiz runner after answer selected. Stored as `answer_records.confidence` (null = not rated). Analytics page shows Confidence Calibration card (overconfident / underconfident / well-calibrated) once ≥5 rated answers exist. **DB migration:** `ALTER TABLE answer_records ADD COLUMN IF NOT EXISTS confidence integer;`
- [x] **Retry Wrong Answers** — Results page shows "Retry Wrong (N)" button when score < 100%. Links to `/quiz/[id]?filter=wrong&fromAttempt=<id>`; quiz page filters questions to wrong-only and creates a correctly-scoped attempt.
- [x] **Question count picker** — Both `GenerateQuizButton` and `SmartQuizDialog` now expose a count selector (5 / 7 / 10 / 12 / 15). `lib/ai/schemas.ts` max bumped from 10 → 15; both API routes `MAX_QUESTIONS = 15`.
- [x] **Smart Quiz title fix** — Quiz title is now `Smart Quiz · {Preset}` (no raw material filenames). Quiz runner header uses quiz title for adaptive quizzes, material title for regular quizzes.

---

## Phase 10 — Autonomous Decisions Log

| Decision | Rationale |
|---|---|
| Confidence stored as `integer` (1/2/3) not `enum` | Simple to query ranges; avoids a Postgres enum migration |
| Confidence value `0` treated as "deselected" client-side, stored as `null` | Lets user toggle off a rating; `null` = not rated in all analytics queries |
| Confidence calibration card hidden below 5 rated answers | Avoids noisy single-sample percentages on new accounts |
| Retry wrong: creates a new attempt with `total = wrongCount` | Consistent with existing attempt model; score and analytics work correctly for the subset |
| Retry wrong: quiz page double-checks `fromAttempt` question IDs after the normal questions fetch | Avoids a separate questions-by-ids query; filtering is O(n) in memory on the already-fetched set |
| Multi-material smart quiz uses first material as `material_id` FK | Schema requires a single `material_id`; changing schema would need a migration. Primary material is used for rate-limiting too. Acceptable for demo. |
| Per-material text cap = `max(15000 / n, 5000)` | Keeps combined context within Gemini's effective window; guarantees ≥5k chars per material so no material is effectively excluded |
| Cited sources via `X-Sources` response header | Headers are sent before streaming body — zero latency penalty. No SDK envelope needed. Cost = one small Supabase SELECT on unique material IDs (already in memory). |
| Question counts: 5 / 7 / 10 / 12 / 15 (not continuous 5–15) | Round numbers that feel intentional; avoids 11/13/14 which feel arbitrary in a demo |

---

## Phase 6 — Analytics UI Issues (fix in Phase 10 polish)

- [ ] **Topic accuracy chart — Y-axis label overlap** — topic names overlap when there are many topics. Fix: increase chart height dynamically based on topic count, or truncate + tooltip on hover.
- [ ] **Rolling accuracy chart — no connecting line** — dots render but the line between them is missing. Likely a Recharts `type="monotone"` or data shape issue. Investigate `connectNulls` prop.
- [ ] **Heatmap/bar chart scale** — currently aggregates ALL answer_records ever (e.g. 20 questions × 2 quizzes = 20 data points). With 100+ questions across 10 quizzes this could get noisy. Consider: cap to last N attempts, or deduplicate by question_id keeping only most recent answer per question.
- [ ] **Dark mode — analytics text invisible** — some text/chart elements lose contrast in dark theme. Audit chart axis tick colors and card text tokens; ensure all use semantic tokens (`text-foreground`, `text-muted-foreground`) not hardcoded colors.

---

## Dashboard — Known TODOs

- [x] **Course card material/quiz counts** — Fixed. Fetches `materials (id, course_id)` and `quizzes (material_id)` in parallel; resolves quiz counts via `material_id → course_id` map. Real counts with pluralisation. (`b096666`)

---

## Phase 7 — Known TODOs / Polish items

- [ ] **`"adaptive"` difficulty badge color** — `QuizPreviewCard` DIFF_COLORS map doesn't include `adaptive`; it falls through to the `mixed` blue. Add a distinct color (e.g. violet) to visually signal Smart-Quiz-authored quizzes.
- [ ] **Analytics-page "jump to weakest topic"** — The CTA in the insights card is material-picker based. A nicer flow would pre-filter materials to those whose past questions hit the user's weakest topic. Requires extra query (quiz → material) joined on questions.topic.
- [ ] **Different rate-limit for Smart Quiz** — Currently shares the 60s/material quiz rate limit. Consider a per-user global rate limit (e.g. 1 smart quiz / 2 min) since Smart Quiz costs more tokens than a regular quiz.
- [x] **User-controlled weak/medium/strong mix** — **Done (Phase 10).** Three presets in `SmartQuizDialog`: Focus Weak (60/30/10), Balanced (40/40/20), Challenge (10/30/60). `planSmartQuiz()` accepts a `SmartQuizPreset` param.
- [x] **Surface the weak/medium/strong plan in UI** — **Done (Phase 10).** Preset label baked into quiz title (`Smart Quiz · Balanced` etc.) and shown in dialog selector. Raw material filename no longer appears as the quiz header.
- [x] **Multi-material Smart Quiz** — **Done (Phase 10).** Dialog now shows a checkbox list grouped by course; API accepts `materialIds[]` and concatenates material text with per-material cap (`max(MAX_TEXT / n, 5000)` chars each).

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

---

## Phase 8 — RAG Study Coach: Known TODOs / Polish items

- [ ] **Re-embed on new material upload** — Currently the user must manually click "Re-index" (RefreshCw button) to embed new materials added after the initial index. Could auto-trigger embedding after a successful upload.
- [ ] **Per-material embedding status** — Currently all materials in a course are embedded together; no indication of which materials are indexed. A per-material "Indexed / Not indexed" badge would improve UX.
- [ ] **Chat history persistence** — Chat history lives in component state; it resets when the sheet closes. Persisting to `localStorage` (keyed by course id) would let users pick up where they left off.
- [ ] **Stream abort on sheet close** — The `AbortController` cancels in-flight requests, but the component doesn't explicitly call `abort()` on unmount. This is benign (the stream will terminate) but could be made explicit.
- [ ] **Markdown rendering** — Assistant responses are rendered as plain text with `<br>` line breaks. Using a lightweight Markdown renderer (e.g. `marked` + `DOMPurify`) would make bullet lists, code blocks, etc. render correctly.
- [x] **Cited sources** — **Done (Phase 10).** `X-Sources` response header carries material titles (zero extra tokens). Chat UI renders "From: [Material Title]" beneath each assistant bubble.
- [ ] **Chunk size tuning** — Current defaults (500 chars, 100 overlap) are conservative. Larger chunks (1000–1500 chars) may give better semantic coherence at the cost of more noise per chunk.

---

---

## Phase 9 — Quiz Rooms: Known TODOs / Polish items (defer to Phase 10)

- [ ] **Reconnect / rejoin on page refresh mid-game** — Room state is rehydrated from DB on refresh (server page re-fetches), but per-question answer state (`myAnswerIndex`) is lost. Could persist to `localStorage` keyed by `roomId + questionIndex`.
- [ ] **> 2 players** — Schema and RLS allow it; the join endpoint caps at 2. Could lift to 4 for team mode with minor changes.
- [ ] **Guest-as-host disconnect** — If host closes tab, guest is stuck (no "transfer host" logic). Acceptable for a 2-window demo.
- [ ] **Room expiry / cleanup** — Finished/stale rooms accumulate in `quiz_rooms`. A Postgres cron job (pg_cron) or Supabase Edge Function could delete rooms older than 24h.
- [ ] **Opponent disconnect detection** — Supabase Realtime presence could show when opponent goes offline. Currently no indication.
- [ ] **Room history** — No page listing past rooms. Could surface from `quiz_rooms WHERE status = 'finished'` joined to `room_participants`.
- [ ] **Sound / haptic feedback on correct answer** — Small polish win for live demo.
- [ ] **Realtime enable reminder** — User must enable Realtime for `quiz_rooms`, `room_participants`, `room_answers` tables in Supabase Dashboard → Database → Replication before the game works live.

---

## Phase 9 — Autonomous Decisions Log

| Decision | Rationale |
|---|---|
| **`revealed_answers` JSONB in `quiz_rooms`** | Both clients need the correct answer after question closes. Storing it in the room row means a single Realtime `UPDATE` delivers the reveal to all clients simultaneously — no extra broadcast or table needed. |
| **Host is the advance authority** | Host's client calls `/next` when timer hits 0 OR all players answered. Prevents split-brain (two clients racing to advance). Guest's UI auto-receives the new state via Realtime. |
| **Auto-advance with 1.8s delay after all answered** | Gives both players a moment to see the "answered" state before the question flips. Short enough to feel snappy. |
| **`correct_index` stripped server-side in page.tsx and API** | Questions are fetched with all columns server-side, then re-mapped to `SanitizedQuestion` (omitting `correct_index`) before passing to the client component. The only path for `correct_index` to reach the client is via `revealed_answers` in the room update, which only happens after the question closes. |
| **`unique(room_id, participant_id, question_index)` on `room_answers`** | Prevents double-answering. The answer endpoint treats `23505` (unique violation) as "already answered" and returns 409 — idempotent and safe. |
| **Idempotent `/next` via `fromQuestion` check** | If host's auto-advance fires twice (timer + all-answered race), the second call sees `room.current_question !== fromQuestion` and returns early. Prevents skipping two questions. |
| **2-player cap in join endpoint** | Competitive 1v1 is the demo story. Cap keeps scoring simple (no tie-break logic). Easy to lift to 4 later. |
| **6-char uppercase room code (no 0/O/1/I)** | Unambiguous for verbal sharing ("B as in bravo"). 34^6 ≈ 1.5B combinations — effectively uncollide-able for a demo. |
| **Scores updated immediately on answer (not on reveal)** | Simpler than batching score updates at reveal time. Score is correct_index comparison done server-side — client never sees the correct answer until reveal. |
| **RLS: any authenticated user can SELECT `quiz_rooms` and `room_participants`** | Needed so guests can look up a room by code before they become participants. Room codes are hard to guess; data exposure (quiz_id, display names) is acceptable for a demo. |
| **No persistent room history or attempt linkage to `quiz_attempts`** | Room scores live in `room_participants.score`. Linking to the solo `quiz_attempts` flow would require a new attempt per player per room, adding complexity. Deferred to Phase 10 polish. |

---

## Phase 8 — Autonomous Decisions Log

| Decision | Rationale |
|---|---|
| **Custom streaming hook instead of `useChat`** | AI SDK v6 (`ai@6`) moved React hooks to `@ai-sdk/react` and changed the response contract (`toUIMessageStreamResponse` instead of `toDataStreamResponse`). The existing ELI5 route proves `toTextStreamResponse()` works. A custom `fetch` + `ReadableStream` loop avoids breaking API changes and is transparent to debug. |
| **`toTextStreamResponse()` on chat route** | Simpler and consistent with the ELI5 pattern. The custom hook reads the raw byte stream directly — no SDK-specific envelope needed. |
| **Lazy embedding (explicit "Prepare for Chat" step)** | Embedding on upload adds latency to the upload flow and wastes tokens if the user never uses chat. On-demand embedding with a clear loading state is better UX for a demo. |
| **Idempotent re-embed (delete-then-insert)** | If materials change, old chunks become stale. Deleting all course chunks before inserting new ones keeps the index consistent at the cost of a brief window where the course has no embeddings. |
| **One index per course (not per material)** | The RAG query is course-scoped — all materials are searched simultaneously. Per-material indexes would require user to pick a material before chatting, which is worse UX. |
| **`text-embedding-004` (768-dim) via Gemini** | Available through the existing `@ai-sdk/google` provider. Same GCP credits as the quiz generation model. 768 dimensions is a good balance of quality vs. storage. |
| **Chunk size: 500 chars, overlap: 100 chars** | Small enough to keep each chunk semantically focused (important for cosine similarity), large enough to preserve sentence context. Sentence-boundary snapping in the chunker reduces mid-sentence splits. |
| **Max text per material: 20,000 chars** | Same order of magnitude as the quiz generation truncation (15k). Keeps embedding cost bounded and avoids Gemini API timeouts on very large materials. |
| **Batch size: 50 chunks per `embedMany` call** | Gemini batch embedding supports up to 100 values per request; 50 is a conservative safety margin. With ≤10 materials × 40 chunks each = max ~400 chunks total, we need at most 8 batch calls. |
| **Top-5 chunks for RAG context** | Enough signal for most questions without blowing the system-prompt token budget. Tunable via the `MATCH_COUNT` constant. |
| **`match_material_chunks` as a Postgres RPC** | pgvector's `<=>` operator cannot be called directly from the Supabase JS client. An RPC function exposes it cleanly. RLS on `material_chunks` still applies inside the function (not `SECURITY DEFINER`). |
| **`material_chunks.embedding` omitted from the TypeScript `Row` type** | The `vector(768)` column is never SELECTed back to the client (too large, always `select("id, content, ...")`). Including it as `number[]` in `Insert` is enough for the insert call. |
| **No rate limit on the embed endpoint** | Embedding is computationally bounded (Gemini handles it) and already has a natural gate (user must click a button). A per-user rate limit can be added in Phase 10 if needed. |
| **`gemini-2.0-flash` model for chat (not `gemini-3-flash-preview`)** | The chat route was a good place to test the stable `gemini-2.0-flash` model. Quiz routes continue to use `gemini-3-flash-preview`. Either can be swapped via a single-line change. |
| **`@ai-sdk/react` installed but unused** | Installed during initial investigation; kept as a dependency since it may be useful in Phase 10 polish if the AI SDK chat API stabilizes. |
