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
      artist_releases: {
        Row: {
          album: string | null
          album_art_url: string | null
          artist_name: string
          created_at: string
          id: string
          release_date: string
          spotify_track_id: string | null
          title: string
        }
        Insert: {
          album?: string | null
          album_art_url?: string | null
          artist_name: string
          created_at?: string
          id?: string
          release_date: string
          spotify_track_id?: string | null
          title: string
        }
        Update: {
          album?: string | null
          album_art_url?: string | null
          artist_name?: string
          created_at?: string
          id?: string
          release_date?: string
          spotify_track_id?: string | null
          title?: string
        }
        Relationships: []
      }
      collection_exclusions: {
        Row: {
          created_at: string | null
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_exclusions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_notes: {
        Row: {
          content: string
          id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discover_posts: {
        Row: {
          author_name: string | null
          body_markdown: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          external_url: string | null
          id: string
          post_type: string
          published_at: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          body_markdown?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          external_url?: string | null
          id?: string
          post_type: string
          published_at?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          body_markdown?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          external_url?: string | null
          id?: string
          post_type?: string
          published_at?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string | null
          following_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string | null
          following_id?: string | null
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
      hidden_tracks: {
        Row: {
          created_at: string | null
          id: string
          track_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          track_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          track_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hidden_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_tracks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          liked_at: string | null
          track_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          liked_at?: string | null
          track_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          liked_at?: string | null
          track_id?: string | null
          user_id?: string | null
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
      profile_views: {
        Row: {
          id: string
          profile_id: string | null
          tab_viewed: string | null
          viewed_at: string | null
          viewer_id: string | null
        }
        Insert: {
          id?: string
          profile_id?: string | null
          tab_viewed?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Update: {
          id?: string
          profile_id?: string | null
          tab_viewed?: string | null
          viewed_at?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apple_music_token: string | null
          apple_music_user_id: string | null
          apple_music_user_token: string | null
          avatar_url: string | null
          created_at: string | null
          current_mood: string | null
          display_name: string | null
          id: string
          last_synced_at: string | null
          login_pin: string | null
          mood_set_at: string | null
          onboarding_complete: boolean | null
          platform: string | null
          preferred_platform: string | null
          profile_color: string | null
          public: boolean | null
          spotify_access_token: string | null
          spotify_id: string | null
          spotify_refresh_token: string | null
          status: string | null
          sync_apple_music: boolean
          sync_spotify: boolean
          sync_tidal: boolean
          sync_youtube: boolean
          tidal_access_token: string | null
          tidal_refresh_token: string | null
          tidal_user_id: string | null
          username: string | null
          youtube_access_token: string | null
          youtube_refresh_token: string | null
          youtube_user_id: string | null
        }
        Insert: {
          apple_music_token?: string | null
          apple_music_user_id?: string | null
          apple_music_user_token?: string | null
          avatar_url?: string | null
          created_at?: string | null
          current_mood?: string | null
          display_name?: string | null
          id: string
          last_synced_at?: string | null
          login_pin?: string | null
          mood_set_at?: string | null
          onboarding_complete?: boolean | null
          platform?: string | null
          preferred_platform?: string | null
          profile_color?: string | null
          public?: boolean | null
          spotify_access_token?: string | null
          spotify_id?: string | null
          spotify_refresh_token?: string | null
          status?: string | null
          sync_apple_music?: boolean
          sync_spotify?: boolean
          sync_tidal?: boolean
          sync_youtube?: boolean
          tidal_access_token?: string | null
          tidal_refresh_token?: string | null
          tidal_user_id?: string | null
          username?: string | null
          youtube_access_token?: string | null
          youtube_refresh_token?: string | null
          youtube_user_id?: string | null
        }
        Update: {
          apple_music_token?: string | null
          apple_music_user_id?: string | null
          apple_music_user_token?: string | null
          avatar_url?: string | null
          created_at?: string | null
          current_mood?: string | null
          display_name?: string | null
          id?: string
          last_synced_at?: string | null
          login_pin?: string | null
          mood_set_at?: string | null
          onboarding_complete?: boolean | null
          platform?: string | null
          preferred_platform?: string | null
          profile_color?: string | null
          public?: boolean | null
          spotify_access_token?: string | null
          spotify_id?: string | null
          spotify_refresh_token?: string | null
          status?: string | null
          sync_apple_music?: boolean
          sync_spotify?: boolean
          sync_tidal?: boolean
          sync_youtube?: boolean
          tidal_access_token?: string | null
          tidal_refresh_token?: string | null
          tidal_user_id?: string | null
          username?: string | null
          youtube_access_token?: string | null
          youtube_refresh_token?: string | null
          youtube_user_id?: string | null
        }
        Relationships: []
      }
      radar_access: {
        Row: {
          created_at: string | null
          granted_by: string | null
          id: string
          invite_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          invite_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          granted_by?: string | null
          id?: string
          invite_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_artists: {
        Row: {
          apple_music_url: string | null
          created_at: string | null
          discovered_at: string | null
          distributor: string | null
          genre: string[] | null
          id: string
          instagram_url: string | null
          location: string | null
          name: string
          photo_url: string | null
          priority: string | null
          soundcloud_url: string | null
          source_platform: string | null
          source_url: string | null
          spotify_artist_id: string | null
          spotify_followers: number | null
          spotify_monthly_listeners: number | null
          spotify_popularity: number | null
          spotify_top_tracks: Json | null
          spotify_url: string | null
          status: string | null
          strengths: string[] | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string | null
          user_id: string | null
          youtube_url: string | null
        }
        Insert: {
          apple_music_url?: string | null
          created_at?: string | null
          discovered_at?: string | null
          distributor?: string | null
          genre?: string[] | null
          id?: string
          instagram_url?: string | null
          location?: string | null
          name: string
          photo_url?: string | null
          priority?: string | null
          soundcloud_url?: string | null
          source_platform?: string | null
          source_url?: string | null
          spotify_artist_id?: string | null
          spotify_followers?: number | null
          spotify_monthly_listeners?: number | null
          spotify_popularity?: number | null
          spotify_top_tracks?: Json | null
          spotify_url?: string | null
          status?: string | null
          strengths?: string[] | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          apple_music_url?: string | null
          created_at?: string | null
          discovered_at?: string | null
          distributor?: string | null
          genre?: string[] | null
          id?: string
          instagram_url?: string | null
          location?: string | null
          name?: string
          photo_url?: string | null
          priority?: string | null
          soundcloud_url?: string | null
          source_platform?: string | null
          source_url?: string | null
          spotify_artist_id?: string | null
          spotify_followers?: number | null
          spotify_monthly_listeners?: number | null
          spotify_popularity?: number | null
          spotify_top_tracks?: Json | null
          spotify_url?: string | null
          status?: string | null
          strengths?: string[] | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string | null
          user_id?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_artists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_invites: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          id: string
          used: boolean | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_metrics: {
        Row: {
          artist_id: string | null
          id: string
          instagram_followers: number | null
          note: string | null
          recorded_at: string | null
          spotify_followers: number | null
          spotify_monthly_listeners: number | null
          tiktok_followers: number | null
          user_id: string
          youtube_subscribers: number | null
        }
        Insert: {
          artist_id?: string | null
          id?: string
          instagram_followers?: number | null
          note?: string | null
          recorded_at?: string | null
          spotify_followers?: number | null
          spotify_monthly_listeners?: number | null
          tiktok_followers?: number | null
          user_id?: string
          youtube_subscribers?: number | null
        }
        Update: {
          artist_id?: string | null
          id?: string
          instagram_followers?: number | null
          note?: string | null
          recorded_at?: string | null
          spotify_followers?: number | null
          spotify_monthly_listeners?: number | null
          tiktok_followers?: number | null
          user_id?: string
          youtube_subscribers?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_metrics_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "radar_artists"
            referencedColumns: ["id"]
          },
        ]
      }
      radar_notes: {
        Row: {
          artist_id: string | null
          content: string
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          artist_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          artist_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radar_notes_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "radar_artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radar_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          created_at: string | null
          emoji: string | null
          id: string
          like_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          like_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string | null
          id?: string
          like_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reactions_like_id_fkey"
            columns: ["like_id"]
            isOneToOne: false
            referencedRelation: "feed_likes"
            referencedColumns: ["id"]
          },
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
          created_at: string | null
          from_user_id: string | null
          id: string
          message: string | null
          seen: boolean | null
          to_user_id: string | null
          track_id: string | null
        }
        Insert: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          message?: string | null
          seen?: boolean | null
          to_user_id?: string | null
          track_id?: string | null
        }
        Update: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          message?: string | null
          seen?: boolean | null
          to_user_id?: string | null
          track_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_tracks: {
        Row: {
          id: string
          saved_at: string | null
          source_context: string | null
          source_user_id: string | null
          track_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          saved_at?: string | null
          source_context?: string | null
          source_user_id?: string | null
          track_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          saved_at?: string | null
          source_context?: string | null
          source_user_id?: string | null
          track_id?: string | null
          user_id?: string | null
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
      search_queries: {
        Row: {
          id: string
          query: string | null
          result_followed: string | null
          results_count: number | null
          searched_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          query?: string | null
          result_followed?: string | null
          results_count?: number | null
          searched_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          query?: string | null
          result_followed?: string | null
          results_count?: number | null
          searched_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_opens: {
        Row: {
          id: string
          opened_at: string | null
          referrer: string | null
          track_id: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          opened_at?: string | null
          referrer?: string | null
          track_id?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          opened_at?: string | null
          referrer?: string | null
          track_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_opens_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      taglines: {
        Row: {
          active: boolean | null
          category: string | null
          id: string
          text: string
          weight: number | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          id?: string
          text: string
          weight?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          id?: string
          text?: string
          weight?: number | null
        }
        Relationships: []
      }
      taste_compatibility: {
        Row: {
          calculated_at: string | null
          score: number | null
          user_a: string | null
          user_b: string | null
        }
        Insert: {
          calculated_at?: string | null
          score?: number | null
          user_a?: string | null
          user_b?: string | null
        }
        Update: {
          calculated_at?: string | null
          score?: number | null
          user_a?: string | null
          user_b?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taste_compatibility_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "taste_compatibility_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "taste_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      track_views: {
        Row: {
          id: string
          mood_context: string | null
          source_context: string | null
          track_id: string | null
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          mood_context?: string | null
          source_context?: string | null
          track_id?: string | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          mood_context?: string | null
          source_context?: string | null
          track_id?: string | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_views_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          album: string | null
          album_art_url: string | null
          apple_music_id: string | null
          artist: string | null
          created_at: string | null
          id: string
          isrc: string | null
          preview_url: string | null
          short_id: string | null
          spotify_track_id: string
          tidal_track_id: string | null
          title: string | null
          track_source: string | null
          youtube_video_id: string | null
        }
        Insert: {
          album?: string | null
          album_art_url?: string | null
          apple_music_id?: string | null
          artist?: string | null
          created_at?: string | null
          id?: string
          isrc?: string | null
          preview_url?: string | null
          short_id?: string | null
          spotify_track_id: string
          tidal_track_id?: string | null
          title?: string | null
          track_source?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          album?: string | null
          album_art_url?: string | null
          apple_music_id?: string | null
          artist?: string | null
          created_at?: string | null
          id?: string
          isrc?: string | null
          preview_url?: string | null
          short_id?: string | null
          spotify_track_id?: string
          tidal_track_id?: string | null
          title?: string | null
          track_source?: string | null
          youtube_video_id?: string | null
        }
        Relationships: []
      }
      user_followed_artists: {
        Row: {
          artist_name: string
          created_at: string
          follow_source: string
          id: string
          user_id: string
        }
        Insert: {
          artist_name: string
          created_at?: string
          follow_source: string
          id?: string
          user_id: string
        }
        Update: {
          artist_name?: string
          created_at?: string
          follow_source?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_followed_artists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          created_at: string
          push_follows: boolean
          push_reactions: boolean
          push_recommendations: boolean
          push_saves: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          push_follows?: boolean
          push_reactions?: boolean
          push_recommendations?: boolean
          push_saves?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          push_follows?: boolean
          push_reactions?: boolean
          push_recommendations?: boolean
          push_saves?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      feed_likes: {
        Row: {
          created_at: string | null
          id: string | null
          liked_at: string | null
          track_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          liked_at?: string | null
          track_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          liked_at?: string | null
          track_id?: string | null
          user_id?: string | null
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
      profile_views_readable: {
        Row: {
          id: string | null
          profile_display_name: string | null
          profile_username: string | null
          tab_viewed: string | null
          viewed_at: string | null
          viewer_display_name: string | null
          viewer_username: string | null
        }
        Relationships: []
      }
      search_queries_readable: {
        Row: {
          id: string | null
          query: string | null
          results_count: number | null
          searched_at: string | null
          viewer_display_name: string | null
          viewer_username: string | null
        }
        Relationships: []
      }
      track_views_readable: {
        Row: {
          id: string | null
          source_context: string | null
          track_artist: string | null
          track_title: string | null
          viewed_at: string | null
          viewer_display_name: string | null
          viewer_username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_apple_music_likes: { Args: { p_user_id: string }; Returns: number }
      get_my_profile: {
        Args: never
        Returns: {
          apple_music_token: string | null
          apple_music_user_id: string | null
          apple_music_user_token: string | null
          avatar_url: string | null
          created_at: string | null
          current_mood: string | null
          display_name: string | null
          id: string
          last_synced_at: string | null
          login_pin: string | null
          mood_set_at: string | null
          onboarding_complete: boolean | null
          platform: string | null
          preferred_platform: string | null
          profile_color: string | null
          public: boolean | null
          spotify_access_token: string | null
          spotify_id: string | null
          spotify_refresh_token: string | null
          status: string | null
          sync_apple_music: boolean
          sync_spotify: boolean
          sync_tidal: boolean
          sync_youtube: boolean
          tidal_access_token: string | null
          tidal_refresh_token: string | null
          tidal_user_id: string | null
          username: string | null
          youtube_access_token: string | null
          youtube_refresh_token: string | null
          youtube_user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
