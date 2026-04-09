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
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          id: string
          liked_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          id?: string
          liked_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          id?: string
          liked_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plai_picks: {
        Row: {
          active: boolean | null
          album: string | null
          album_art_url: string | null
          artist: string
          id: string
          note: string | null
          position: number
          spotify_track_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          album?: string | null
          album_art_url?: string | null
          artist: string
          id?: string
          note?: string | null
          position: number
          spotify_track_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          album?: string | null
          album_art_url?: string | null
          artist?: string
          id?: string
          note?: string | null
          position?: number
          spotify_track_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          last_synced_at: string | null
          login_pin: string | null
          onboarding_complete: boolean
          platform: string | null
          preferred_platform: string | null
          profile_color: string | null
          public: boolean
          spotify_access_token: string | null
          spotify_id: string | null
          spotify_refresh_token: string | null
          status: string | null
          tidal_access_token: string | null
          tidal_refresh_token: string | null
          tidal_user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          last_synced_at?: string | null
          login_pin?: string | null
          onboarding_complete?: boolean
          platform?: string | null
          preferred_platform?: string | null
          profile_color?: string | null
          public?: boolean
          spotify_access_token?: string | null
          spotify_id?: string | null
          spotify_refresh_token?: string | null
          status?: string | null
          tidal_access_token?: string | null
          tidal_refresh_token?: string | null
          tidal_user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_synced_at?: string | null
          login_pin?: string | null
          onboarding_complete?: boolean
          platform?: string | null
          preferred_platform?: string | null
          profile_color?: string | null
          public?: boolean
          spotify_access_token?: string | null
          spotify_id?: string | null
          spotify_refresh_token?: string | null
          status?: string | null
          tidal_access_token?: string | null
          tidal_refresh_token?: string | null
          tidal_user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          like_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          like_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          like_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_like_id_fkey"
            columns: ["like_id"]
            isOneToOne: false
            referencedRelation: "likes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string
          from_user_id: string
          id: string
          message: string | null
          seen: boolean
          to_user_id: string
          track_id: string
        }
        Insert: {
          created_at?: string
          from_user_id: string
          id?: string
          message?: string | null
          seen?: boolean
          to_user_id: string
          track_id: string
        }
        Update: {
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string | null
          seen?: boolean
          to_user_id?: string
          track_id?: string
        }
        Relationships: []
      }
      saved_tracks: {
        Row: {
          id: string
          saved_at: string
          source_context: string | null
          source_user_id: string | null
          track_id: string
          user_id: string
        }
        Insert: {
          id?: string
          saved_at?: string
          source_context?: string | null
          source_user_id?: string | null
          track_id: string
          user_id: string
        }
        Update: {
          id?: string
          saved_at?: string
          source_context?: string | null
          source_user_id?: string | null
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_tracks_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_tracks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      taglines: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          id: string
          text: string
          weight: number | null
        }
        Insert: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          text: string
          weight?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          text?: string
          weight?: number | null
        }
        Relationships: []
      }
      taste_compatibility: {
        Row: {
          calculated_at: string | null
          score: number
          user_a: string
          user_b: string
        }
        Insert: {
          calculated_at?: string | null
          score: number
          user_a: string
          user_b: string
        }
        Update: {
          calculated_at?: string | null
          score?: number
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      taste_profiles: {
        Row: {
          activity_score: number | null
          last_calculated: string | null
          top_artists: Json | null
          top_tracks: Json | null
          user_id: string
        }
        Insert: {
          activity_score?: number | null
          last_calculated?: string | null
          top_artists?: Json | null
          top_tracks?: Json | null
          user_id: string
        }
        Update: {
          activity_score?: number | null
          last_calculated?: string | null
          top_artists?: Json | null
          top_tracks?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          album: string | null
          album_art_url: string | null
          artist: string
          created_at: string
          id: string
          preview_url: string | null
          spotify_track_id: string
          tidal_track_id: string | null
          title: string
          youtube_video_id: string | null
        }
        Insert: {
          album?: string | null
          album_art_url?: string | null
          artist: string
          created_at?: string
          id?: string
          preview_url?: string | null
          spotify_track_id: string
          tidal_track_id?: string | null
          title: string
          youtube_video_id?: string | null
        }
        Update: {
          album?: string | null
          album_art_url?: string | null
          artist?: string
          created_at?: string
          id?: string
          preview_url?: string | null
          spotify_track_id?: string
          tidal_track_id?: string | null
          title?: string
          youtube_video_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      set_login_pin: {
        Args: { p_pin: string; p_user_id: string }
        Returns: undefined
      }
      verify_login_pin: {
        Args: { p_email: string; p_pin: string }
        Returns: boolean
      }
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
