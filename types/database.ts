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
          confidence: number | null; // 1=Unsure, 2=Maybe, 3=Confident, null=not rated
          created_at: string;
        };
        Insert: {
          id?: string;
          attempt_id: string;
          question_id: string;
          selected_index: number;
          is_correct: boolean;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          attempt_id?: string;
          question_id?: string;
          selected_index?: number;
          is_correct?: boolean;
          confidence?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      material_chunks: {
        Row: {
          id: string;
          material_id: string;
          course_id: string;
          content: string;
          chunk_index: number;
          // embedding column (vector(768)) intentionally omitted — never fetched to client
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          course_id: string;
          content: string;
          chunk_index: number;
          embedding?: number[]; // passed as number[] on insert
          created_at?: string;
        };
        Update: {
          embedding?: number[];
        };
        Relationships: [];
      };
      quiz_rooms: {
        Row: {
          id: string;
          code: string;
          quiz_id: string;
          host_user_id: string;
          status: "waiting" | "active" | "finished";
          current_question: number;
          question_started_at: string | null;
          question_duration_seconds: number;
          revealed_answers: Record<string, number>; // { "0": 2, "1": 3 ... } question_index → correct_index
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          quiz_id: string;
          host_user_id: string;
          status?: "waiting" | "active" | "finished";
          current_question?: number;
          question_started_at?: string | null;
          question_duration_seconds?: number;
          revealed_answers?: Record<string, number>;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          quiz_id?: string;
          host_user_id?: string;
          status?: "waiting" | "active" | "finished";
          current_question?: number;
          question_started_at?: string | null;
          question_duration_seconds?: number;
          revealed_answers?: Record<string, number>;
          created_at?: string;
        };
        Relationships: [];
      };
      room_participants: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          display_name: string;
          score: number;
          joined_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          display_name: string;
          score?: number;
          joined_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          user_id?: string;
          display_name?: string;
          score?: number;
          joined_at?: string;
        };
        Relationships: [];
      };
      room_answers: {
        Row: {
          id: string;
          room_id: string;
          participant_id: string;
          question_index: number;
          selected_index: number;
          is_correct: boolean;
          answered_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          participant_id: string;
          question_index: number;
          selected_index: number;
          is_correct: boolean;
          answered_at?: string;
        };
        Update: {
          id?: string;
          room_id?: string;
          participant_id?: string;
          question_index?: number;
          selected_index?: number;
          is_correct?: boolean;
          answered_at?: string;
        };
        Relationships: [];
      };
      material_notes: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          content: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          content?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      flashcard_sets: {
        Row: {
          id: string;
          user_id: string;
          material_id: string;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          material_id: string;
          title: string;
          created_at?: string;
        };
        Update: {
          title?: string;
        };
        Relationships: [];
      };
      flashcards: {
        Row: {
          id: string;
          set_id: string;
          front: string;
          back: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          set_id: string;
          front: string;
          back: string;
          sort_order: number;
          created_at?: string;
        };
        Update: {
          front?: string;
          back?: string;
          sort_order?: number;
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

export type MaterialChunk = Database["public"]["Tables"]["material_chunks"]["Row"];

export type MaterialNote = Database["public"]["Tables"]["material_notes"]["Row"];
export type FlashcardSet = Database["public"]["Tables"]["flashcard_sets"]["Row"];
export type Flashcard = Database["public"]["Tables"]["flashcards"]["Row"];
export type FlashcardSetWithCards = FlashcardSet & { flashcards: Flashcard[] };

export type AiInsight = Database["public"]["Tables"]["ai_insights"]["Row"];
export type AiInsightContent = AiInsight["content"];

export type QuizRoom = Database["public"]["Tables"]["quiz_rooms"]["Row"];
export type RoomParticipant = Database["public"]["Tables"]["room_participants"]["Row"];
export type RoomAnswer = Database["public"]["Tables"]["room_answers"]["Row"];

// Question with correct_index stripped — safe to send to client during active game
export type SanitizedQuestion = Omit<Question, "correct_index">;
