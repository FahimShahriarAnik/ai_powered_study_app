import { createClient } from "@/lib/supabase/server";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questionId } = (await request.json()) as { questionId: string };
  if (!questionId) {
    return NextResponse.json({ error: "questionId required" }, { status: 400 });
  }

  const { data: question } = await supabase
    .from("questions")
    .select("question, options, correct_index, explanation")
    .eq("id", questionId)
    .single();

  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const correctOption = question.options[question.correct_index];

  const result = streamText({
    model: google("gemini-3-flash-preview"),
    prompt: `Explain this concept using a simple, everyday analogy that a 10-year-old could follow. Keep it to 2-3 short sentences. Friendly, concrete, and vivid. Don't restate the question; dive straight into the analogy.

Question: ${question.question}
Correct answer: ${correctOption}
Textbook explanation: ${question.explanation}

Your simple analogy:`,
  });

  return result.toTextStreamResponse();
}
