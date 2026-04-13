export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          raw_text: string;
          file_url: string | null;
          char_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          raw_text: string;
          file_url?: string | null;
          char_count: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          raw_text?: string;
          file_url?: string | null;
          char_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      quizzes: {
        Row: {
          id: string;
          material_id: string;
          title: string;
          difficulty: string;
          question_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          title: string;
          difficulty: string;
          question_count: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          material_id?: string;
          title?: string;
          difficulty?: string;
          question_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          quiz_id: string;
          question: string;
          options: string[];
          correct_index: number;
          topic: string;
          difficulty: string;
          explanation: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          question: string;
          options: string[];
          correct_index: number;
          topic: string;
          difficulty: string;
          explanation: string;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          question?: string;
          options?: string[];
          correct_index?: number;
          topic?: string;
          difficulty?: string;
          explanation?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          id: string;
          quiz_id: string;
          user_id: string;
          score: number | null;
          total: number;
          notes: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          user_id: string;
          score?: number | null;
          total: number;
          notes?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          user_id?: string;
          score?: number | null;
          total?: number;
          notes?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      answer_records: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected_index: number;
          is_correct: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          selected_index: number;
          is_correct: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          question_id?: string;
          selected_index?: number;
          is_correct?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_insights: {
        Row: {
          id: string;
          user_id: string;
          content: {
            weakest: { topic: string; accuracy: number };
            strongest: { topic: string; accuracy: number };
            summary: string;
            recommendation: string;
          };
          attempts_at_refresh: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: {
            weakest: { topic: string; accuracy: number };
            strongest: { topic: string; accuracy: number };
            summary: string;
            recommendation: string;
          };
          attempts_at_refresh: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: {
            weakest: { topic: string; accuracy: number };
            strongest: { topic: string; accuracy: number };
            summary: string;
            recommendation: string;
          };
          attempts_at_refresh?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type Material = Database["public"]["Tables"]["materials"]["Row"];
export type Quiz = Database["public"]["Tables"]["quizzes"]["Row"];
export type Question = Database["public"]["Tables"]["questions"]["Row"];
export type QuizAttempt = Database["public"]["Tables"]["quiz_attempts"]["Row"];
export type AnswerRecord = Database["public"]["Tables"]["answer_records"]["Row"];

export type QuizWithQuestions = Quiz & { questions: Question[] };
export type QuizWithAttempts = Quiz & {
  questions: Question[];
  attempts: QuizAttempt[];
};

export type AiInsight = Database["public"]["Tables"]["ai_insights"]["Row"];
export type AiInsightContent = AiInsight["content"];
