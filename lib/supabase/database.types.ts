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
      admin_audit: {
        Row: {
          action: string;
          admin_id: string | null;
          changes: Json;
          created_at: string;
          id: number;
          target_id: string;
          target_type: string;
        };
        Insert: {
          action: string;
          admin_id?: string | null;
          changes?: Json;
          created_at?: string;
          id?: never;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          admin_id?: string | null;
          changes?: Json;
          created_at?: string;
          id?: never;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [];
      };
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
      announcements: {
        Row: {
          body: string;
          class_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          body: string;
          class_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          body?: string;
          class_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      api_batch_cost: {
        Row: {
          day: string;
          micros: number;
          user_id: string;
        };
        Insert: {
          day: string;
          micros?: number;
          user_id: string;
        };
        Update: {
          day?: string;
          micros?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      api_calls: {
        Row: {
          audio_ms: number;
          chars: number;
          cost_micros: number;
          created_at: string;
          error: string | null;
          error_code: string | null;
          http_status: number | null;
          id: number;
          input_tokens: number;
          operation: string;
          outcome: string | null;
          output_tokens: number;
          provider: string;
          user_id: string | null;
        };
        Insert: {
          audio_ms?: number;
          chars?: number;
          cost_micros?: number;
          created_at?: string;
          error?: string | null;
          error_code?: string | null;
          http_status?: number | null;
          id?: never;
          input_tokens?: number;
          operation: string;
          outcome?: string | null;
          output_tokens?: number;
          provider: string;
          user_id?: string | null;
        };
        Update: {
          audio_ms?: number;
          chars?: number;
          cost_micros?: number;
          created_at?: string;
          error?: string | null;
          error_code?: string | null;
          http_status?: number | null;
          id?: never;
          input_tokens?: number;
          operation?: string;
          outcome?: string | null;
          output_tokens?: number;
          provider?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      api_daily_cost: {
        Row: {
          day: string;
          micros: number;
          user_id: string;
        };
        Insert: {
          day: string;
          micros?: number;
          user_id: string;
        };
        Update: {
          day?: string;
          micros?: number;
          user_id?: string;
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
      assignments: {
        Row: {
          class_id: string;
          created_at: string;
          due_on: string;
          id: string;
          rules: Json | null;
          starts_on: string;
          title: string;
          video_id: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          due_on: string;
          id?: string;
          rules?: Json | null;
          starts_on: string;
          title: string;
          video_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          due_on?: string;
          id?: string;
          rules?: Json | null;
          starts_on?: string;
          title?: string;
          video_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      beta_invite_uses: {
        Row: {
          invite_id: string;
          used_at: string;
          user_id: string;
        };
        Insert: {
          invite_id: string;
          used_at?: string;
          user_id: string;
        };
        Update: {
          invite_id?: string;
          used_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "beta_invite_uses_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "beta_invites";
            referencedColumns: ["id"];
          },
        ];
      };
      beta_invites: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          max_uses: number;
          note: string | null;
          revoked_at: string | null;
          uses: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          max_uses?: number;
          note?: string | null;
          revoked_at?: string | null;
          uses?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          max_uses?: number;
          note?: string | null;
          revoked_at?: string | null;
          uses?: number;
        };
        Relationships: [];
      };
      beta_waitlist: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          invite_id: string | null;
          invited_at: string | null;
          purpose: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          invite_id?: string | null;
          invited_at?: string | null;
          purpose?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          invite_id?: string | null;
          invited_at?: string | null;
          purpose?: string;
        };
        Relationships: [
          {
            foreignKeyName: "beta_waitlist_invite_id_fkey";
            columns: ["invite_id"];
            isOneToOne: false;
            referencedRelation: "beta_invites";
            referencedColumns: ["id"];
          },
        ];
      };
      class_members: {
        Row: {
          class_id: string;
          display_name: string;
          joined_at: string;
          minor_consent: boolean;
          user_id: string;
        };
        Insert: {
          class_id: string;
          display_name: string;
          joined_at?: string;
          minor_consent?: boolean;
          user_id: string;
        };
        Update: {
          class_id?: string;
          display_name?: string;
          joined_at?: string;
          minor_consent?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          invite_code: string;
          name: string;
          teacher_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          invite_code: string;
          name: string;
          teacher_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          invite_code?: string;
          name?: string;
          teacher_id?: string;
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
      content_fixes: {
        Row: {
          created_at: string;
          current: Json;
          detail: Json;
          field: string;
          id: string;
          kind: string;
          practice_id: string;
          reason: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          sentence_index: number;
          source: string;
          status: string;
          suggested: Json;
        };
        Insert: {
          created_at?: string;
          current: Json;
          detail?: Json;
          field: string;
          id?: string;
          kind: string;
          practice_id: string;
          reason?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          sentence_index: number;
          source: string;
          status?: string;
          suggested: Json;
        };
        Update: {
          created_at?: string;
          current?: Json;
          detail?: Json;
          field?: string;
          id?: string;
          kind?: string;
          practice_id?: string;
          reason?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          sentence_index?: number;
          source?: string;
          status?: string;
          suggested?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "content_fixes_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
        ];
      };
      error_logs: {
        Row: {
          created_at: string;
          digest: string | null;
          id: number;
          message: string;
          method: string | null;
          path: string | null;
          route_type: string | null;
          stack: string | null;
        };
        Insert: {
          created_at?: string;
          digest?: string | null;
          id?: never;
          message: string;
          method?: string | null;
          path?: string | null;
          route_type?: string | null;
          stack?: string | null;
        };
        Update: {
          created_at?: string;
          digest?: string | null;
          id?: never;
          message?: string;
          method?: string | null;
          path?: string | null;
          route_type?: string | null;
          stack?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          code: string | null;
          created_at: string;
          day: number | null;
          id: number;
          score: number | null;
          type: string;
          user_id: string | null;
          video_id: string | null;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          day?: number | null;
          id?: never;
          score?: number | null;
          type: string;
          user_id?: string | null;
          video_id?: string | null;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          day?: number | null;
          id?: never;
          score?: number | null;
          type?: string;
          user_id?: string | null;
          video_id?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          message: string;
          page: string | null;
          status: string;
          user_id: string | null;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          message: string;
          page?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          message?: string;
          page?: string | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      health_checks: {
        Row: {
          checked_at: string;
          checks: Json;
          id: number;
          status: string;
        };
        Insert: {
          checked_at?: string;
          checks?: Json;
          id?: never;
          status: string;
        };
        Update: {
          checked_at?: string;
          checks?: Json;
          id?: never;
          status?: string;
        };
        Relationships: [];
      };
      intent_events: {
        Row: {
          billing_interval: string | null;
          created_at: string;
          id: number;
          item: string | null;
          plan: string | null;
          source: string | null;
          step: string;
          user_id: string | null;
          visitor_id: string;
        };
        Insert: {
          billing_interval?: string | null;
          created_at?: string;
          id?: never;
          item?: string | null;
          plan?: string | null;
          source?: string | null;
          step: string;
          user_id?: string | null;
          visitor_id: string;
        };
        Update: {
          billing_interval?: string | null;
          created_at?: string;
          id?: never;
          item?: string | null;
          plan?: string | null;
          source?: string | null;
          step?: string;
          user_id?: string | null;
          visitor_id?: string;
        };
        Relationships: [];
      };
      ops_alerts: {
        Row: {
          created_at: string;
          id: number;
          key: string;
          level: string;
          message: string;
          notified: boolean;
        };
        Insert: {
          created_at?: string;
          id?: never;
          key: string;
          level: string;
          message: string;
          notified?: boolean;
        };
        Update: {
          created_at?: string;
          id?: never;
          key?: string;
          level?: string;
          message?: string;
          notified?: boolean;
        };
        Relationships: [];
      };
      ops_samples: {
        Row: {
          database_bytes: number;
          day: string;
          storage_bytes: number;
        };
        Insert: {
          database_bytes: number;
          day: string;
          storage_bytes: number;
        };
        Update: {
          database_bytes?: number;
          day?: string;
          storage_bytes?: number;
        };
        Relationships: [];
      };
      payment_events: {
        Row: {
          event_id: string;
          provider: string;
          received_at: string;
          type: string;
        };
        Insert: {
          event_id: string;
          provider: string;
          received_at?: string;
          type: string;
        };
        Update: {
          event_id?: string;
          provider?: string;
          received_at?: string;
          type?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          billing_interval: string | null;
          created_at: string;
          currency: string;
          id: string;
          provider: string;
          provider_payment_id: string;
          refunded_at: string | null;
          status: string;
          test: boolean;
          user_id: string;
        };
        Insert: {
          amount: number;
          billing_interval?: string | null;
          created_at?: string;
          currency: string;
          id?: string;
          provider: string;
          provider_payment_id: string;
          refunded_at?: string | null;
          status: string;
          test?: boolean;
          user_id: string;
        };
        Update: {
          amount?: number;
          billing_interval?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          provider?: string;
          provider_payment_id?: string;
          refunded_at?: string | null;
          status?: string;
          test?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      practice_creations: {
        Row: {
          created_at: string;
          id: number;
          practice_id: string | null;
          seconds: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          practice_id?: string | null;
          seconds: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          practice_id?: string | null;
          seconds?: number;
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
          end_sec: number | null;
          i: number;
          notes: Json | null;
          practice_id: string;
          speaker: number | null;
          start_sec: number | null;
          zh: string;
        };
        Insert: {
          audio_path?: string | null;
          en: string;
          end_sec?: number | null;
          i: number;
          notes?: Json | null;
          practice_id: string;
          speaker?: number | null;
          start_sec?: number | null;
          zh?: string;
        };
        Update: {
          audio_path?: string | null;
          en?: string;
          end_sec?: number | null;
          i?: number;
          notes?: Json | null;
          practice_id?: string;
          speaker?: number | null;
          start_sec?: number | null;
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
      practice_versions: {
        Row: {
          created_at: string;
          grammar: Json;
          practice_id: string;
          sentences: Json;
          title: string;
          version: number;
          vocab: Json;
        };
        Insert: {
          created_at?: string;
          grammar: Json;
          practice_id: string;
          sentences: Json;
          title: string;
          version: number;
          vocab: Json;
        };
        Update: {
          created_at?: string;
          grammar?: Json;
          practice_id?: string;
          sentences?: Json;
          title?: string;
          version?: number;
          vocab?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "practice_versions_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
        ];
      };
      practices: {
        Row: {
          attribution: Json | null;
          categories: string[] | null;
          category: string | null;
          collection_id: string | null;
          created_at: string;
          duration_sec: number | null;
          estimated_seconds: number | null;
          exam: string | null;
          exam_target: string | null;
          generation_seconds: number | null;
          grammar: Json;
          id: string;
          level: string | null;
          notes_generated_at: string | null;
          official: boolean;
          published: boolean;
          removed_at: string | null;
          removed_reason: string | null;
          rights_confirmed_at: string | null;
          scenario: string | null;
          sort_order: number | null;
          source_audio_path: string | null;
          source_audio_seconds: number | null;
          source_language: string;
          source_name: string | null;
          source_title: string | null;
          source_url: string | null;
          subtitle: string | null;
          title: string;
          title_en: string | null;
          title_zh: string | null;
          updated_at: string;
          user_id: string;
          version: number;
          visibility: string;
          vocab: Json;
          voice: string | null;
          voice_b: string | null;
          youtube_channel: string | null;
          youtube_id: string | null;
          youtube_license: string | null;
        };
        Insert: {
          attribution?: Json | null;
          categories?: string[] | null;
          category?: string | null;
          collection_id?: string | null;
          created_at?: string;
          duration_sec?: number | null;
          estimated_seconds?: number | null;
          exam?: string | null;
          exam_target?: string | null;
          generation_seconds?: number | null;
          grammar?: Json;
          id?: string;
          level?: string | null;
          notes_generated_at?: string | null;
          official?: boolean;
          published?: boolean;
          removed_at?: string | null;
          removed_reason?: string | null;
          rights_confirmed_at?: string | null;
          scenario?: string | null;
          sort_order?: number | null;
          source_audio_path?: string | null;
          source_audio_seconds?: number | null;
          source_language: string;
          source_name?: string | null;
          source_title?: string | null;
          source_url?: string | null;
          subtitle?: string | null;
          title: string;
          title_en?: string | null;
          title_zh?: string | null;
          updated_at?: string;
          user_id?: string;
          version?: number;
          visibility?: string;
          vocab?: Json;
          voice?: string | null;
          voice_b?: string | null;
          youtube_channel?: string | null;
          youtube_id?: string | null;
          youtube_license?: string | null;
        };
        Update: {
          attribution?: Json | null;
          categories?: string[] | null;
          category?: string | null;
          collection_id?: string | null;
          created_at?: string;
          duration_sec?: number | null;
          estimated_seconds?: number | null;
          exam?: string | null;
          exam_target?: string | null;
          generation_seconds?: number | null;
          grammar?: Json;
          id?: string;
          level?: string | null;
          notes_generated_at?: string | null;
          official?: boolean;
          published?: boolean;
          removed_at?: string | null;
          removed_reason?: string | null;
          rights_confirmed_at?: string | null;
          scenario?: string | null;
          sort_order?: number | null;
          source_audio_path?: string | null;
          source_audio_seconds?: number | null;
          source_language?: string;
          source_name?: string | null;
          source_title?: string | null;
          source_url?: string | null;
          subtitle?: string | null;
          title?: string;
          title_en?: string | null;
          title_zh?: string | null;
          updated_at?: string;
          user_id?: string;
          version?: number;
          visibility?: string;
          vocab?: Json;
          voice?: string | null;
          voice_b?: string | null;
          youtube_channel?: string | null;
          youtube_id?: string | null;
          youtube_license?: string | null;
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
      profiles: {
        Row: {
          ai_suspended_at: string | null;
          ai_suspended_reason: string | null;
          beta_admitted_at: string | null;
          beta_admitted_via: string | null;
          classroom_seats: number | null;
          created_at: string;
          last_seen_at: string | null;
          number: number;
          plan: string;
          practices_created: number;
          role: string;
          status: string;
          student_verified_at: string | null;
          time_zone: string | null;
          user_id: string;
        };
        Insert: {
          ai_suspended_at?: string | null;
          ai_suspended_reason?: string | null;
          beta_admitted_at?: string | null;
          beta_admitted_via?: string | null;
          classroom_seats?: number | null;
          created_at?: string;
          last_seen_at?: string | null;
          number?: number;
          plan?: string;
          practices_created?: number;
          role?: string;
          status?: string;
          student_verified_at?: string | null;
          time_zone?: string | null;
          user_id: string;
        };
        Update: {
          ai_suspended_at?: string | null;
          ai_suspended_reason?: string | null;
          beta_admitted_at?: string | null;
          beta_admitted_via?: string | null;
          classroom_seats?: number | null;
          created_at?: string;
          last_seen_at?: string | null;
          number?: number;
          plan?: string;
          practices_created?: number;
          role?: string;
          status?: string;
          student_verified_at?: string | null;
          time_zone?: string | null;
          user_id?: string;
        };
        Relationships: [];
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
      quota_overrides: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string;
          extra: number;
          id: string;
          limit_name: string;
          reason: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          extra: number;
          id?: string;
          limit_name: string;
          reason: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          extra?: number;
          id?: string;
          limit_name?: string;
          reason?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          hits: number;
          key: string;
          window_start: string;
        };
        Insert: {
          hits?: number;
          key: string;
          window_start: string;
        };
        Update: {
          hits?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          last_sent_on: string | null;
          locale: string;
          p256dh: string;
          remind_at: string;
          time_zone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          last_sent_on?: string | null;
          locale?: string;
          p256dh: string;
          remind_at: string;
          time_zone: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          last_sent_on?: string | null;
          locale?: string;
          p256dh?: string;
          remind_at?: string;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sentence_reports: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          material_version: number | null;
          note: string | null;
          notified_at: string | null;
          resolution_note: string | null;
          resolved_at: string | null;
          sentence_index: number;
          status: string;
          user_id: string;
          video_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          material_version?: number | null;
          note?: string | null;
          notified_at?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          sentence_index: number;
          status?: string;
          user_id?: string;
          video_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          material_version?: number | null;
          note?: string | null;
          notified_at?: string | null;
          resolution_note?: string | null;
          resolved_at?: string | null;
          sentence_index?: number;
          status?: string;
          user_id?: string;
          video_id?: string;
        };
        Relationships: [];
      };
      shadowing_issues: {
        Row: {
          browser: string;
          coverages: number[];
          created_at: string;
          heard: string[];
          id: string;
          material_version: number | null;
          sentence_index: number;
          skipped: boolean;
          user_id: string | null;
          video_id: string;
        };
        Insert: {
          browser: string;
          coverages: number[];
          created_at?: string;
          heard: string[];
          id?: string;
          material_version?: number | null;
          sentence_index: number;
          skipped: boolean;
          user_id?: string | null;
          video_id: string;
        };
        Update: {
          browser?: string;
          coverages?: number[];
          created_at?: string;
          heard?: string[];
          id?: string;
          material_version?: number | null;
          sentence_index?: number;
          skipped?: boolean;
          user_id?: string | null;
          video_id?: string;
        };
        Relationships: [];
      };
      shared_practice_grants: {
        Row: {
          created_at: string;
          practice_id: string;
          started_at: string;
          user_id: string;
          week: number;
        };
        Insert: {
          created_at?: string;
          practice_id: string;
          started_at: string;
          user_id: string;
          week: number;
        };
        Update: {
          created_at?: string;
          practice_id?: string;
          started_at?: string;
          user_id?: string;
          week?: number;
        };
        Relationships: [
          {
            foreignKeyName: "shared_practice_grants_practice_id_fkey";
            columns: ["practice_id"];
            isOneToOne: false;
            referencedRelation: "practices";
            referencedColumns: ["id"];
          },
        ];
      };
      signup_settings: {
        Row: {
          cap: number;
          id: boolean;
          open: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          cap?: number;
          id?: boolean;
          open?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          cap?: number;
          id?: boolean;
          open?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      site_announcements: {
        Row: {
          body_en: string;
          body_zh: string;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          level: string;
          starts_at: string;
        };
        Insert: {
          body_en: string;
          body_zh: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          level?: string;
          starts_at?: string;
        };
        Update: {
          body_en?: string;
          body_zh?: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          level?: string;
          starts_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          features: Json;
          id: boolean;
          maintenance: boolean;
          read_only: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          features?: Json;
          id?: boolean;
          maintenance?: boolean;
          read_only?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          features?: Json;
          id?: boolean;
          maintenance?: boolean;
          read_only?: boolean;
          updated_at?: string;
          updated_by?: string | null;
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
      subscriptions: {
        Row: {
          billing_interval: string;
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string;
          provider: string;
          provider_subscription_id: string;
          status: string;
          test: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          billing_interval: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end: string;
          provider: string;
          provider_subscription_id: string;
          status: string;
          test?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          billing_interval?: string;
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string;
          provider?: string;
          provider_subscription_id?: string;
          status?: string;
          test?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      usage_settings: {
        Row: {
          admin_batch_micros: number;
          admin_manual_micros: number;
          free_micros: number;
          id: number;
          paid_micros: number;
          site_monthly_micros: number;
          updated_at: string;
        };
        Insert: {
          admin_batch_micros?: number;
          admin_manual_micros?: number;
          free_micros?: number;
          id?: number;
          paid_micros?: number;
          site_monthly_micros?: number;
          updated_at?: string;
        };
        Update: {
          admin_batch_micros?: number;
          admin_manual_micros?: number;
          free_micros?: number;
          id?: number;
          paid_micros?: number;
          site_monthly_micros?: number;
          updated_at?: string;
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
      vocab_quiz_attempts: {
        Row: {
          day: number;
          hints_used: number;
          id: string;
          spelling_correct: number;
          taken_at: string;
          total: number;
          translation_correct: number;
          user_id: string;
          video_id: string;
          words: Json;
        };
        Insert: {
          day: number;
          hints_used: number;
          id?: string;
          spelling_correct: number;
          taken_at?: string;
          total: number;
          translation_correct: number;
          user_id?: string;
          video_id: string;
          words: Json;
        };
        Update: {
          day?: number;
          hints_used?: number;
          id?: string;
          spelling_correct?: number;
          taken_at?: string;
          total?: number;
          translation_correct?: number;
          user_id?: string;
          video_id?: string;
          words?: Json;
        };
        Relationships: [];
      };
      waitlist: {
        Row: {
          billing_period: string | null;
          created_at: string;
          plan: string | null;
          source: string | null;
          user_id: string;
        };
        Insert: {
          billing_period?: string | null;
          created_at?: string;
          plan?: string | null;
          source?: string | null;
          user_id: string;
        };
        Update: {
          billing_period?: string | null;
          created_at?: string;
          plan?: string | null;
          source?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      weekly_reports: {
        Row: {
          created_at: string;
          summary: Json;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          summary: Json;
          week_start: string;
        };
        Update: {
          created_at?: string;
          summary?: Json;
          week_start?: string;
        };
        Relationships: [];
      };
      work_queue: {
        Row: {
          enqueued_at: string;
          priority: number;
          resource: string;
          seen_at: string;
          ticket: string;
          user_id: string | null;
        };
        Insert: {
          enqueued_at?: string;
          priority?: number;
          resource: string;
          seen_at?: string;
          ticket: string;
          user_id?: string | null;
        };
        Update: {
          enqueued_at?: string;
          priority?: number;
          resource?: string;
          seen_at?: string;
          ticket?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_overview: {
        Args: { day_start: string; week_start: string };
        Returns: {
          active_today: number;
          active_week: number;
          database_bytes: number;
          days_completed_week: number;
          new_practices_week: number;
          new_users_week: number;
          storage_bytes: number;
          users: number;
        }[];
      };
      admin_users: {
        Args: { month_start: string };
        Returns: {
          created_at: string;
          last_seen_at: string;
          month_micros: number;
          number: number;
          practices: number;
          role: string;
          status: string;
          user_id: string;
        }[];
      };
      admit_account: {
        Args: { as_admin: boolean; invite_code: string; target: string };
        Returns: string;
      };
      api_usage_totals: {
        Args: { day_start: string; month_start: string };
        Returns: {
          azure_micros: number;
          month_azure_speech_chars: number;
          month_micros: number;
          today_calls: number;
          today_micros: number;
        }[];
      };
      beta_admitted_count: { Args: never; Returns: number };
      can_practice: { Args: { target: string }; Returns: boolean };
      class_progress: {
        Args: { target: string };
        Returns: {
          data: Json;
          user_id: string;
          video_id: string;
        }[];
      };
      copy_practice_as_official: {
        Args: { actor: string; source: string };
        Returns: string;
      };
      daily_api_cost: {
        Args: { day_start: string; days: number };
        Returns: {
          day: string;
          micros: number;
        }[];
      };
      hit_rate_limit: {
        Args: { limit_key: string; max_hits: number; window_seconds: number };
        Returns: boolean;
      };
      is_admin: { Args: never; Returns: boolean };
      is_class_member: { Args: { target: string }; Returns: boolean };
      is_class_teacher: { Args: { target: string }; Returns: boolean };
      join_class: {
        Args: { code: string; consent: boolean; name: string };
        Returns: string;
      };
      material_learner_counts: {
        Args: never;
        Returns: {
          learners: number;
          video_id: string;
        }[];
      };
      month_api_cost: { Args: { month_start: string }; Returns: number };
      month_audio_ms: {
        Args: { month_start: string; target_user: string };
        Returns: {
          mine: number;
          site: number;
        }[];
      };
      ops_snapshot: {
        Args: { day_start: string; month_start: string };
        Returns: Json;
      };
      orphan_audio: {
        Args: { max_rows: number; older_than: string };
        Returns: {
          bucket: string;
          path: string;
        }[];
      };
      practice_audio_bytes: {
        Args: { ids: string[] };
        Returns: {
          bytes: number;
          mime_type: string;
          practice_id: string;
        }[];
      };
      practice_audio_seconds: { Args: { target: string }; Returns: number };
      practice_notes: {
        Args: { target: string };
        Returns: {
          grammar: Json;
          vocab: Json;
        }[];
      };
      practice_preview: { Args: { target: string }; Returns: Json };
      prune_logs: { Args: never; Returns: undefined };
      public_practice_readiness: {
        Args: { targets: string[] };
        Returns: {
          practice_id: string;
          sentences: number;
          voiced: number;
        }[];
      };
      queue_leave: { Args: { target_ticket: string }; Returns: undefined };
      queue_position: {
        Args: {
          stale_seconds: number;
          target_priority: number;
          target_resource: string;
          target_ticket: string;
          target_user: string;
        };
        Returns: number;
      };
      reserve_api_batch_cost: {
        Args: {
          amount: number;
          max_micros: number;
          target_user: string;
          usage_day: string;
        };
        Returns: boolean;
      };
      reserve_api_cost: {
        Args: {
          amount: number;
          max_micros: number;
          target_user: string;
          usage_day: string;
        };
        Returns: boolean;
      };
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
      save_practice_edit: {
        Args: {
          expected_version: number;
          new_grammar: Json;
          new_sentences: Json;
          new_title: string;
          new_vocab: Json;
          new_voice: string;
          new_voice_b?: string;
          notes_ready: boolean;
          target: string;
        };
        Returns: number;
      };
      settle_api_batch_cost: {
        Args: { delta: number; target_user: string; usage_day: string };
        Returns: undefined;
      };
      settle_api_cost: {
        Args: { delta: number; target_user: string; usage_day: string };
        Returns: undefined;
      };
      storage_file_counts: {
        Args: never;
        Returns: {
          bucket: string;
          files: number;
        }[];
      };
      upgrade_practice_notes: {
        Args: {
          new_grammar: Json;
          new_notes: Json;
          new_vocab: Json;
          target: string;
        };
        Returns: number;
      };
      weekly_numbers: {
        Args: { week_end: string; week_start: string };
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
