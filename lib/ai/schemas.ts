import { z } from "zod";

export const questionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).length(4),
  correct_index: z.number().int().min(0).max(3),
  topic: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  explanation: z.string(),
});

export const quizSchema = z.object({
  questions: z.array(questionSchema).min(1).max(15),
});

export type QuestionSchema = z.infer<typeof questionSchema>;
export type QuizSchema = z.infer<typeof quizSchema>;

export const analyticsInsightSchema = z.object({
  weakest: z.object({
    topic: z.string(),
    accuracy: z.number().min(0).max(1),
  }),
  strongest: z.object({
    topic: z.string(),
    accuracy: z.number().min(0).max(1),
  }),
  summary: z.string().max(400),
  recommendation: z.string().max(200),
});

export type AnalyticsInsightSchema = z.infer<typeof analyticsInsightSchema>;
