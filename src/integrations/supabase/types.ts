export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      players: {
        Row: {
          avatar_url: string | null
          current_space: number
          finish_rank: number | null
          finished_at: string | null
          fitness_level: number
          id: string
          joined_at: string
          room_code: string
          score: number
          status: string
          user_id: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          current_space?: number
          finish_rank?: number | null
          finished_at?: string | null
          fitness_level?: number
          id?: string
          joined_at?: string
          room_code: string
          score?: number
          status?: string
          user_id?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          current_space?: number
          finish_rank?: number | null
          finished_at?: string | null
          fitness_level?: number
          id?: string
          joined_at?: string
          room_code?: string
          score?: number
          status?: string
          user_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          fitness_level: number
          games_finished: number
          lifetime_score: number
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          fitness_level?: number
          games_finished?: number
          lifetime_score?: number
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          fitness_level?: number
          games_finished?: number
          lifetime_score?: number
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          board_overrides: Json
          code: string
          created_at: string
          current_turn_player_id: string | null
          difficulty_multiplier: number
          host_id: string
          last_dice: number | null
          locked: boolean
          paused: boolean
          status: string
          trap: Json | null
        }
        Insert: {
          board_overrides?: Json
          code: string
          created_at?: string
          current_turn_player_id?: string | null
          difficulty_multiplier?: number
          host_id?: string
          last_dice?: number | null
          locked?: boolean
          paused?: boolean
          status?: string
          trap?: Json | null
        }
        Update: {
          board_overrides?: Json
          code?: string
          created_at?: string
          current_turn_player_id?: string | null
          difficulty_multiplier?: number
          host_id?: string
          last_dice?: number | null
          locked?: boolean
          paused?: boolean
          status?: string
          trap?: Json | null
        }
        Relationships: []
      }
      workout_logs: {
        Row: {
          created_at: string
          exercise_name: string
          id: string
          player_id: string
          room_code: string
          target_reps: number
          time_taken_ms: number | null
          verified_by_judge: boolean | null
        }
        Insert: {
          created_at?: string
          exercise_name: string
          id?: string
          player_id: string
          room_code: string
          target_reps: number
          time_taken_ms?: number | null
          verified_by_judge?: boolean | null
        }
        Update: {
          created_at?: string
          exercise_name?: string
          id?: string
          player_id?: string
          room_code?: string
          target_reps?: number
          time_taken_ms?: number | null
          verified_by_judge?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
