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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_releases: {
        Row: {
          album: string | null
          album_art_url: string | null
          album_type: string | null
          artist_name: string
          created_at: string
          id: string
          release_date: string
          spotify_album_id: string | null
          spotify_track_id: string | null
          title: string
          total_tracks: number | null
        }
        Insert: {
          album?: string | null
          album_art_url?: string | null
          album_type?: string | null
          artist_name: string
          created_at?: string
          id?: string
          release_date: string
          spotify_album_id?: string | null
          spotify_track_id?: string | null
          title: string
          total_tracks?: number | null
        }
        Update: {
          album?: string | null
          album_art_url?: string | null
          album_type?: string | null
          artist_name?: string
          created_at?: string
          id?: string
          release_date?: string
          spotify_album_id?: string | null
          spotify_track_id?: string | null
          title?: string
          total_tracks?: number | null
        }
        Relationships: []
      }
      chart_tracks: {
        Row: {
          chart: string
          fetched_at: string
          position: number
          track_id: string
        }
        Insert: {
          chart?: string
          fetched_at?: string
          position: number
          track_id: string
        }
        Update: {
          chart?: string
          fetched_at?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
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
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json | null
          id: string
          pushed_at: string | null
          read: boolean
          track_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          pushed_at?: string | null
          read?: boolean
          track_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          pushed_at?: string | null
          read?: boolean
          track_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_login_attempts: {
        Row: {
          created_at: string
          id: number
          ok: boolean
          username: string
        }
        Insert: {
          created_at?: string
          id?: never
          ok: boolean
          username: string
        }
        Update: {
          created_at?: string
          id?: never
          ok?: boolean
          username?: string
        }
        Relationships: []
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
          invited_by: string | null
          last_seen_at: string | null
          last_synced_at: string | null
          login_pin: string | null
          mood_set_at: string | null
          onboarding_complete: boolean | null
          pick_note: string | null
          pick_set_at: string | null
          pick_track_id: string | null
          plai_playlist_id: string | null
          platform: string | null
          preferred_platform: string | null
          profile_color: string | null
          public: boolean | null
          releases_synced_at: string | null
          spotify_access_token: string | null
          spotify_backfilled_at: string | null
          spotify_id: string | null
          spotify_playlist_id: string | null
          spotify_playlist_name: string | null
          spotify_playlist_synced_at: string | null
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
          invited_by?: string | null
          last_seen_at?: string | null
          last_synced_at?: string | null
          login_pin?: string | null
          mood_set_at?: string | null
          onboarding_complete?: boolean | null
          pick_note?: string | null
          pick_set_at?: string | null
          pick_track_id?: string | null
          plai_playlist_id?: string | null
          platform?: string | null
          preferred_platform?: string | null
          profile_color?: string | null
          public?: boolean | null
          releases_synced_at?: string | null
          spotify_access_token?: string | null
          spotify_backfilled_at?: string | null
          spotify_id?: string | null
          spotify_playlist_id?: string | null
          spotify_playlist_name?: string | null
          spotify_playlist_synced_at?: string | null
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
          invited_by?: string | null
          last_seen_at?: string | null
          last_synced_at?: string | null
          login_pin?: string | null
          mood_set_at?: string | null
          onboarding_complete?: boolean | null
          pick_note?: string | null
          pick_set_at?: string | null
          pick_track_id?: string | null
          plai_playlist_id?: string | null
          platform?: string | null
          preferred_platform?: string | null
          profile_color?: string | null
          public?: boolean | null
          releases_synced_at?: string | null
          spotify_access_token?: string | null
          spotify_backfilled_at?: string | null
          spotify_id?: string | null
          spotify_playlist_id?: string | null
          spotify_playlist_name?: string | null
          spotify_playlist_synced_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_pick_track_id_fkey"
            columns: ["pick_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      protected_artist_names: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device: string | null
          endpoint: string
          id: string
          last_sent_at: string | null
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device?: string | null
          endpoint: string
          id?: string
          last_sent_at?: string | null
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device?: string | null
          endpoint?: string
          id?: string
          last_sent_at?: string | null
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      recommendation_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          recommendation_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recommendation_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recommendation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_replies_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendation_replies_user_id_fkey"
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
          reacted_at: string | null
          reaction: string | null
          seen: boolean | null
          source: string
          to_user_id: string | null
          track_id: string | null
        }
        Insert: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          message?: string | null
          reacted_at?: string | null
          reaction?: string | null
          seen?: boolean | null
          source?: string
          to_user_id?: string | null
          track_id?: string | null
        }
        Update: {
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          message?: string | null
          reacted_at?: string | null
          reaction?: string | null
          seen?: boolean | null
          source?: string
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
          sharer_id: string | null
          track_id: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          opened_at?: string | null
          referrer?: string | null
          sharer_id?: string | null
          track_id?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          opened_at?: string | null
          referrer?: string | null
          sharer_id?: string | null
          track_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_opens_sharer_id_fkey"
            columns: ["sharer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_opens_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          created_at: string
          detail: string | null
          id: number
          platform: string
          status: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: never
          platform: string
          status?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: never
          platform?: string
          status?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_user_id_fkey"
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
      track_details: {
        Row: {
          credits_complete: boolean
          data: Json
          fetched_at: string
          track_id: string
        }
        Insert: {
          credits_complete?: boolean
          data?: Json
          fetched_at?: string
          track_id: string
        }
        Update: {
          credits_complete?: boolean
          data?: Json
          fetched_at?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_details_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: true
            referencedRelation: "tracks"
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
          amazon_music_id: string | null
          apple_music_id: string | null
          artist: string | null
          created_at: string | null
          genres: string[] | null
          id: string
          isrc: string | null
          preview_url: string | null
          short_id: string | null
          spotify_link_id: string | null
          spotify_track_id: string
          tidal_track_id: string | null
          title: string | null
          track_source: string | null
          youtube_video_id: string | null
        }
        Insert: {
          album?: string | null
          album_art_url?: string | null
          amazon_music_id?: string | null
          apple_music_id?: string | null
          artist?: string | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          isrc?: string | null
          preview_url?: string | null
          short_id?: string | null
          spotify_link_id?: string | null
          spotify_track_id: string
          tidal_track_id?: string | null
          title?: string | null
          track_source?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          album?: string | null
          album_art_url?: string | null
          amazon_music_id?: string | null
          apple_music_id?: string | null
          artist?: string | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          isrc?: string | null
          preview_url?: string | null
          short_id?: string | null
          spotify_link_id?: string | null
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
      user_notify_follows: {
        Row: {
          created_at: string
          follower_id: string
          id: string
          target_user_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          id?: string
          target_user_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          id?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notify_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notify_follows_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_recaps: {
        Row: {
          created_at: string
          data: Json
          dismissed: boolean
          id: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          data: Json
          dismissed?: boolean
          id?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          data?: Json
          dismissed?: boolean
          id?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_recaps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      accept_invite: { Args: { p_username: string }; Returns: string }
      admin_activity: {
        Args: never
        Returns: {
          apps: string[]
          avatar_url: string
          broken_apps: string[]
          display_name: string
          followers: number
          following: number
          invited_by: string
          joined: string
          last_seen_at: string
          last_synced_at: string
          likes_7d: number
          push_devices: number
          reactions_7d: number
          sent_7d: number
          username: string
        }[]
      }
      build_weekly_recap: {
        Args: { p_since: string; p_user: string }
        Returns: Json
      }
      build_weekly_recap_base: {
        Args: { p_since: string; p_user: string }
        Returns: Json
      }
      call_send_push: { Args: { p_body: Json }; Returns: undefined }
      claim_shared_link: {
        Args: { p_from_username: string; p_track_id: string }
        Returns: boolean
      }
      clear_connection_issue: {
        Args: { p_platform: string }
        Returns: undefined
      }
      create_notification: {
        Args: {
          p_actor_id: string
          p_extra?: Json
          p_track_id: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      delete_apple_music_likes: { Args: { p_user_id: string }; Returns: number }
      friends_picks: {
        Args: never
        Returns: {
          album_art_url: string
          amazon_music_id: string
          apple_music_id: string
          artist: string
          avatar_url: string
          display_name: string
          note: string
          set_at: string
          short_id: string
          spotify_link_id: string
          spotify_track_id: string
          tidal_track_id: string
          title: string
          track_id: string
          user_id: string
          username: string
        }[]
      }
      generate_short_id: { Args: never; Returns: string }
      generate_weekly_recaps: { Args: never; Returns: number }
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
          invited_by: string | null
          last_seen_at: string | null
          last_synced_at: string | null
          login_pin: string | null
          mood_set_at: string | null
          onboarding_complete: boolean | null
          pick_note: string | null
          pick_set_at: string | null
          pick_track_id: string | null
          plai_playlist_id: string | null
          platform: string | null
          preferred_platform: string | null
          profile_color: string | null
          public: boolean | null
          releases_synced_at: string | null
          spotify_access_token: string | null
          spotify_backfilled_at: string | null
          spotify_id: string | null
          spotify_playlist_id: string | null
          spotify_playlist_name: string | null
          spotify_playlist_synced_at: string | null
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
      is_admin: { Args: never; Returns: boolean }
      is_rec_participant: { Args: { p_rec: string }; Returns: boolean }
      like_hidden_by_owner: {
        Args: { p_track_id: string; p_user_id: string }
        Returns: boolean
      }
      my_connection_issues: {
        Args: never
        Returns: {
          platform: string
          since: string
        }[]
      }
      my_friend_matches: {
        Args: never
        Returns: {
          score: number
          user_id: string
        }[]
      }
      my_sent_recommendations: {
        Args: { p_limit?: number }
        Returns: {
          album: string
          album_art_url: string
          amazon_music_id: string
          apple_music_id: string
          artist: string
          created_at: string
          id: string
          message: string
          reaction: string
          saved: boolean
          seen: boolean
          short_id: string
          source: string
          spotify_link_id: string
          spotify_track_id: string
          tidal_track_id: string
          title: string
          to_avatar_url: string
          to_display_name: string
          to_id: string
          to_username: string
          track_id: string
        }[]
      }
      my_share_stats: {
        Args: never
        Returns: {
          album_art_url: string
          artist: string
          last_opened_at: string
          opens: number
          opens_7d: number
          title: string
          total_opens: number
          track_id: string
        }[]
      }
      my_taste_match: { Args: { p_other: string }; Returns: Json }
      rebuild_taste_profiles: { Args: never; Returns: Json }
      recommend_candidates: {
        Args: { p_track_id?: string }
        Returns: {
          already_sent: boolean
          avatar_url: string
          display_name: string
          id: string
          last_sent_at: string
          relation: string
          sent_count: number
          username: string
        }[]
      }
      redeem_radar_invite: { Args: { p_code: string }; Returns: boolean }
      refresh_taste_compatibility: { Args: never; Returns: number }
      save_push_subscription: {
        Args: {
          p_auth: string
          p_device: string
          p_endpoint: string
          p_p256dh: string
        }
        Returns: undefined
      }
      set_song_of_week: {
        Args: { p_note?: string; p_track_id: string }
        Returns: undefined
      }
      split_artists: { Args: { p_artist: string }; Returns: string[] }
      suggest_people: {
        Args: { p_limit?: number }
        Returns: {
          avatar_url: string
          current_mood: string
          display_name: string
          id: string
          mutual_follows: number
          profile_color: string
          reason: string
          shared_artists: number
          shared_songs: number
          username: string
        }[]
      }
      sync_needs_reconnect: {
        Args: { p_detail: string; p_status: number }
        Returns: boolean
      }
      taste_match_details: { Args: { p_a: string; p_b: string }; Returns: Json }
      touch_last_seen: { Args: never; Returns: undefined }
      tracks_needing_genres: {
        Args: { p_limit?: number }
        Returns: {
          apple_id: string
          artist: string
          id: string
          isrc: string
          title: string
        }[]
      }
      trending_tracks: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          album: string
          album_art_url: string
          amazon_music_id: string
          apple_music_id: string
          artist: string
          likers: number
          opens: number
          reactions: number
          saves: number
          score: number
          short_id: string
          spotify_link_id: string
          spotify_track_id: string
          tidal_track_id: string
          title: string
          track_id: string
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
