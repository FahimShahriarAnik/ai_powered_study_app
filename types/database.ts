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

export type QuizWithQuestions = Quiz & { questions: Question[] };
