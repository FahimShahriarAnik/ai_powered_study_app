# Phase 5 Extensions — Backlog

> Ideas generated after Phase 5 shipped. All are additive — no existing behavior changes, no breaking DB migrations. Implement after Phase 6 if time permits, or during Phase 10 polish.

---

## Extension A — Per-Topic Score Breakdown on Results

**Effort:** ~30 min · **DB change:** None

**What:** On the results page, group questions by `q.topic`, compute correct/total per group, render colored progress bars above the notes block.

- Green ≥ 70% · Yellow 40–69% · Red < 40%
- Data already available: `questions` + `recordByQuestion` are props on `ResultsClient`
- Bridges visually to Phase 6 analytics

**File:** `app/(app)/courses/[id]/quiz/[quizId]/results/[attemptId]/results-client.tsx` only

---

## Extension B — Per-Question Time Tracking

**Effort:** ~1 hr · **DB change:** 2 nullable INT columns

**What:** Record how many milliseconds the user spent on each question and total quiz duration. Fully passive — no UI shown to user.

**SQL:**
```sql
ALTER TABLE answer_records ADD COLUMN IF NOT EXISTS time_taken_ms integer;
ALTER TABLE quiz_attempts  ADD COLUMN IF NOT EXISTS time_taken_ms integer;
```

**Files:**
- `quiz-runner.tsx` — add `questionEnteredAt` ref; on navigation record entry timestamp; compute delta at submit
- `lib/actions/attempts.ts` — accept `timeTakenMs` per answer + total; insert into DB
- `types/database.ts` — add `time_taken_ms: number | null` to both tables

**Phase 6 value:** Enables slow-on-hard, fast-but-wrong (overconfidence), hesitation pattern charts.

---

## Extension C — Confidence Self-Rating

**Effort:** ~45 min · **DB change:** 1 nullable INT column

**What:** After selecting an answer, show 3 inline buttons:
```
[🤔 Unsure]  [🤷 Maybe]  [💡 Confident]
```
Stored as `confidence = 1 | 2 | 3` in `answer_records`. Most demo-visible addition.

**SQL:**
```sql
ALTER TABLE answer_records ADD COLUMN IF NOT EXISTS confidence integer;
-- 1 = Unsure, 2 = Maybe, 3 = Confident
```

**Files:**
- `quiz-runner.tsx` — add `confidence` state (same map pattern as `answers`); render buttons after options; pass to submit
- `lib/actions/attempts.ts` — accept + insert `confidence`
- `types/database.ts` — add `confidence: number | null` to `answer_records`

**Phase 6/7 value:** Enables "Confident-but-Wrong" (overconfidence) and "Unsure-but-Right" (lucky guess) detection. Direct input for Phase 7 adaptive difficulty.

---

## Extension D — "Retry Wrong Answers" Button

**Effort:** ~2 hrs · **DB change:** None

**What:** Button on results page — "Retry Wrong Answers (N)". Navigates to quiz runner with `?filter=wrong&fromAttempt=<id>`. Server page reads that attempt's wrong `answer_records`, fetches only those questions, creates a new attempt with `total = wrongCount`.

**Files:**
- `results-client.tsx` — count wrong answers; add button linking to `?filter=wrong&fromAttempt=<id>`; hide if wrongCount = 0
- `app/(app)/courses/[id]/quiz/[quizId]/page.tsx` — read `searchParams`; if filter=wrong, query wrong answer_records, filter questions, start scoped attempt

**Demo value:** Strongest learning-loop narrative for judges. The app explicitly drills you on what you got wrong.

---

## Other Ideas (lower priority)

| Idea | Notes |
|---|---|
| Keyboard shortcuts (1–4 = option, →/Enter = next) | Pure client, no DB, good polish |
| Session storage answer recovery on refresh | Persist `answers` state to `sessionStorage[attemptId]`; restore on remount |
| ELI5 rate limiting | Simple 1-req/question guard in `/api/eli5` to prevent abuse |
| Multi-attempt score trend (mini chart) | Small Recharts line chart in QuizPreviewCard showing score history across attempts — bridges to Phase 6 visually |
| Practice mode (show answer immediately after each question) | Toggle before starting; no submit-at-end flow; doesn't save to DB |
