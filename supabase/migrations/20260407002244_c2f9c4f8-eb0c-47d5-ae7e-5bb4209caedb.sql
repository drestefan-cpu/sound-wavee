
alter table profiles add column if not exists tidal_access_token text;
alter table profiles add column if not exists tidal_refresh_token text;
alter table profiles add column if not exists platform text default 'spotify';
alter table profiles add column if not exists preferred_platform text default 'spotify';
alter table tracks add column if not exists tidal_track_id text;

create table if not exists taglines (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  category text not null default 'core',
  active boolean default true,
  weight integer default 1,
  created_at timestamptz default now()
);

create table if not exists plai_picks (
  id uuid default gen_random_uuid() primary key,
  position integer not null,
  spotify_track_id text,
  title text not null,
  artist text not null,
  album text,
  album_art_url text,
  note text,
  active boolean default true,
  updated_at timestamptz default now()
);

insert into taglines (text, category, weight) values
  ('it pleases me', 'core', 3),
  ('if you like it, i love it', 'core', 3),
  ('i love your taste', 'main', 3),
  ('you''re onto something', 'main', 3),
  ('come listen to this', 'main', 3),
  ('i think you''ll like this', 'main', 3),
  ('oh yeah, you like that?', 'main', 2),
  ('stay here a minute', 'main', 2),
  ('have a great day', 'positive', 2),
  ('make somebody else''s day', 'positive', 2),
  ('this is a good moment', 'positive', 2),
  ('enjoy this one', 'positive', 2),
  ('j''aime bien', 'language', 1),
  ('me gusta', 'language', 1),
  ('mi piace', 'language', 1),
  ('gefällt mir', 'language', 1),
  ('gosto disso', 'language', 1),
  ('いいね', 'language', 1),
  ('감사해요', 'language', 1),
  ('merci', 'language', 1)
on conflict do nothing;

alter table taglines enable row level security;
create policy "public read taglines" on taglines for select using (true);

alter table plai_picks enable row level security;
create policy "public read plai_picks" on plai_picks for select using (true);
