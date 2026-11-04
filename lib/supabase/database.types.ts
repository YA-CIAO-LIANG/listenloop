export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_cache: {
        Row: {
          created_at: string;
          hash: string;
          kind: string;
          result: Json;
        };
        Insert: {
          created_at?: string;
          hash: string;
          kind: string;
          result: Json;
        };
        Update: {
          created_at?: string;
          hash?: string;
          kind?: string;
          result?: Json;
        };
        Relationships: [];
      };
      api_usage: {
        Row: {
          chars: number;
          day: string;
          kind: string;
          user_id: string;
        };
        Insert: {
          chars?: number;
          day: string;
          kind: string;
          user_id: string;
        };
        Update: {
          chars?: number;
          day?: string;
          kind?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      collections: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          title: string;
          updated_at?: string;
          user_id?: string;
          visibility?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          visibility?: string;
        };
        Relationships: [];
      };
      notebook_entries: {
        Row: {
          created_at: string;
          id: string;
          note: string;
          notebook_id: string;
          sentence: number | null;
          source: string | null;
          text: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          note?: string;
          notebook_id: string;
          sentence?: number | null;
          source?: string | null;
          text: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          note?: string;
          notebook_id?: string;
          sentence?: number | null;
          source?: string | null;
          text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notebook_entries_notebook_id_fkey";
            columns: ["notebook_id"];
            isOneToOne: false;
            referencedRelation: "notebooks";
            referencedColumns: ["id"];
          },
        ];
      };
      notebooks: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      practice_reports: {
        Row: {
          created_at: string;
          details: string;
          id: string;
          practice_id: string;
          reason: string;
          reporter_id: string;
          resolved_at: string | null;
          status: string;
        };
        Insert: {
          created_at?: string;
          details?: string;
          id?: string;
          practice_id: string;
          reason: string;
          reporter_id?: string;
          resolved_at?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          details?: string;
          id?: string;
          practice_id?: string;
          reason?: string;
          reporter_id?: string;
          resolved_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_reports_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
        ];
      };
      practice_sentences: {
        Row: {
          audio_path: string | null;
          en: string;
          i: number;
          practice_id: string;
          zh: string;
        };
        Insert: {
          audio_path?: string | null;
          en: string;
          i: number;
          practice_id: string;
          zh?: string;
        };
        Update: {
          audio_path?: string | null;
          en?: string;
          i?: number;
          practice_id?: string;
          zh?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_sentences_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
        ];
      };
      practices: {
        Row: {
          collection_id: string | null;
          created_at: string;
          grammar: Json;
          id: string;
          notes_generated_at: string | null;
          removed_at: string | null;
          removed_reason: string | null;
          source_language: string;
          title: string;
          updated_at: string;
          user_id: string;
          visibility: string;
          vocab: Json;
          voice: string | null;
        };
        Insert: {
          collection_id?: string | null;
          created_at?: string;
          grammar?: Json;
          id?: string;
          notes_generated_at?: string | null;
          removed_at?: string | null;
          removed_reason?: string | null;
          source_language: string;
          title: string;
          updated_at?: string;
          user_id?: string;
          visibility?: string;
          vocab?: Json;
          voice?: string | null;
        };
        Update: {
          collection_id?: string | null;
          created_at?: string;
          grammar?: Json;
          id?: string;
          notes_generated_at?: string | null;
          removed_at?: string | null;
          removed_reason?: string | null;
          source_language?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          visibility?: string;
          vocab?: Json;
          voice?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "practices_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "collections";
            referencedColumns: ["id"];
          },
        ];
      };
      progress: {
        Row: {
          data: Json;
          updated_at: string;
          user_id: string;
          video_id: string;
        };
        Insert: {
          data: Json;
          updated_at?: string;
          user_id: string;
          video_id: string;
        };
        Update: {
          data?: Json;
          updated_at?: string;
          user_id?: string;
          video_id?: string;
        };
        Relationships: [];
      };
      speech_audio: {
        Row: {
          bytes: number;
          created_at: string;
          hash: string;
          mime_type: string;
          path: string;
        };
        Insert: {
          bytes: number;
          created_at?: string;
          hash: string;
          mime_type: string;
          path: string;
        };
        Update: {
          bytes?: number;
          created_at?: string;
          hash?: string;
          mime_type?: string;
          path?: string;
        };
        Relationships: [];
      };
      user_documents: {
        Row: {
          data: Json;
          key: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          data: Json;
          key: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          data?: Json;
          key?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      reserve_api_usage: {
        Args: {
          amount: number;
          max_chars: number;
          target_user: string;
          usage_day: string;
          usage_kind: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
