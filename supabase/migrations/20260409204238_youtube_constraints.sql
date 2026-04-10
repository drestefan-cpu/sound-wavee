alter table tracks add constraint tracks_youtube_video_id_unique unique (youtube_video_id);

create unique index if not exists likes_user_track_unique on likes(user_id, track_id);

create table if not exists hidden_tracks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  track_id uuid references tracks(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, track_id)
);
