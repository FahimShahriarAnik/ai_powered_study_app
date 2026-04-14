# Plan: Drop RAG — switch chat to full-context injection

## Context

RAG (embed → chunk → vector search) added complexity, rate limit fragility, and a required "Prepare for Chat" step before users could chat. Gemini Flash has a 1M token context window; a typical course (5 materials × 15K chars) is ~18K tokens — far under the limit. Dropping RAG simplifies the architecture, removes the embedding pipeline entirely, and makes chat work immediately on open.

---

## Changes

### 1. `app/api/chat/route.ts` — full rewrite

**Remove:** embedding model, `embed()` call, RPC call, `MatchedChunk` type, `MATCH_COUNT` constant  
**Add:** load `raw_text` from materials table (filtered by materialIds if provided)

```ts
export async function POST(request: NextRequest) {
  // ... auth + courseId validation (unchanged) ...

  const { messages, courseId, materialIds } = body;

  // Load materials (all, or filtered subset)
  let query = supabase
    .from("materials")
    .select("id, title, raw_text")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });

  if (materialIds && materialIds.length > 0) {
    query = query.in("id", materialIds);
  }
  const { data: materials } = await query;

  const contextBlock = materials?.length
    ? materials.map(m => `## ${m.title}\n\n${m.raw_text}`).join("\n\n---\n\n")
    : "No course materials available.";

  const sourceTitles = (materials ?? []).map(m => m.title);

  // system prompt + streamText (unchanged structure)
  // X-Sources header (unchanged)
}
```

**Files:** [app/api/chat/route.ts](../app/api/chat/route.ts)

---

### 2. `components/chat/course-chat-sheet.tsx` — simplify state

**Remove:**
- `EmbedStatus` type and `embedStatus`, `embedError`, `chunkCount` state
- `checkEmbedStatus()`, `handleEmbed()`, `handleReEmbed()` functions
- `useEffect` that called `checkEmbedStatus` on open
- Embedding gate UI block (the "Materials not yet indexed" / "Indexing course materials" section, lines ~325-426)
- RefreshCw re-index button in header

**Change:**
- `selectedMaterialIds` default: initialize to all material IDs (so all are selected by default when sheet opens)
- `toggleMaterial`: remove the "keep at least one" guard — allow empty selection (= all materials)
- Empty selection in `sendMessage` → sends `materialIds: undefined` (route treats missing = all)
- `useEffect` on open: only call `fetchMaterials()`, then set `selectedMaterialIds` to full set
- Chat UI renders immediately (no gate)
- Material filter pills remain (user can narrow context to specific materials)

**Files:** [components/chat/course-chat-sheet.tsx](../components/chat/course-chat-sheet.tsx)

---

### 3. `app/api/embed-course/route.ts` — leave as-is

Route is now unused but harmless. No need to delete for beta1 (stability over cleanup).

---

## UI flow after change

1. User opens chat sheet → materials load → all selected by default → chat input ready immediately
2. Optional: user deselects materials to narrow context
3. Each message fetches raw_text from selected materials — no pre-embedding step needed

---

## Rate limits / cost

No embedding calls = no TPM/RPM concerns. Only Gemini chat tokens consumed per message.

---

## Verification

1. Open AI Study Coach sheet → chat input visible immediately (no "Prepare for Chat" gate)
2. Send a question → response references material content
3. Deselect a material → re-ask → response should not reference that material's content
4. Course with no materials → graceful "No course materials available" response
5. `npm run build` passes cleanly
