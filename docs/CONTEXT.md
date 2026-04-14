# CONTEXT.md

## The Competition

- **Host:** Business Analytics department, student competition.
- **Format:** Build a web app with help of AI tools (Antigravity, GitHub, Vercel mentioned).
- **Team size:** Up to 3, we are a team.
- **Presentation:** Panel of judges. App must be functional and demonstrable.

## The Prompt (Required Features)

1. Users can **upload or import study guides and class materials**.
2. App **generates multiple-choice quiz questions** from the content.
3. App **tracks quiz results** and **identifies user strengths and weaknesses**.

## Going Beyond (Differentiators)

> "Be creative and explore features that make studying more effective, intuitive, or engaging."

This is where the competition is won. Judges are from a Business Analytics department — they will reward:
- **Deep AI integration** (not just one API call — AI woven through the experience)
- **Analytics-rich dashboards** (strengths/weaknesses visualizations, performance trends, predictive insights)
- **Creative AI features** beyond MCQ generation

## Our Differentiator Bets (Going Beyond)

| Feature | Why it wins |
|---|---|
| **Adaptive difficulty** | AI adjusts MCQ difficulty based on past performance per topic |
| **AI study coach (RAG chat)** | Chat with your uploaded materials — "explain this concept", "give me a harder question on X" |
| **Strengths/weaknesses analytics** | Topic-level mastery scores, trend lines, AI-generated study recommendations |
| **In-quiz sticky notes** | Take notes while quizzing; saved with attempt for later review |
| **ELI5 explanations** | One-tap simplified analogy for any question explanation |
| **Auto-generated study plan** | AI builds a personalized review schedule based on weak topics + exam date |
| **Collaborative / competitive quiz rooms** | Two users on same material in sync (Supabase Realtime) |
| **Study Mode** | Per-material reader, persistent notes, AI-generated flashcards with 3D flip-card UI |

## Why Free Stack Works

- **Supabase free:** 500 MB Postgres, 50K MAU, Realtime, Auth (incl. anonymous), 1 GB storage. Auto-pauses after 7 days inactive — log in weekly.
- **Vercel free (Hobby):** Unlimited deploys, 100 GB bandwidth/mo. Plenty for demo.
- **Gemini via GCP:** $300 credits cover Gemini 2.0 Flash for thousands of generations. Use Flash (cheap + fast) not Pro.
- **Total monthly cost:** $0.

## Design Philosophy

- **Demo-driven:** Every phase ends with something visible/clickable to show judges.
- **Stability first:** A polished smaller scope > broken larger scope. Cut features ruthlessly if they destabilize.
- **AI-forward UX:** AI features feel central, not bolted on. Streaming responses, clear "AI is thinking" states.
- **Analytics aesthetic:** Clean dashboards, charts (recharts), data viz that signals "we know analytics."
- **Two-user demo:** App should support 2 concurrent users for live collaborative demo (likely on same machine, two browser windows).

## Future Planning (Post-Competition or If Time Permits)

- **Note hub:** unified view of all notes (in-quiz + on-material) searchable across courses.
- **Mobile-native (React Native/Expo)** wrapper.
- **Spaced repetition** scheduling for missed questions.
- **Voice-mode quiz** (audio MCQs for commute studying).

## Out of Scope (Unless Time Permits)

- Mobile-native app (responsive web is enough for judges)
- Payment/billing
- Email notifications
- Admin panel
