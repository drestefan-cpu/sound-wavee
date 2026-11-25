-- Splitting an artist field into individual artists, without breaking names that contain the
-- separators themselves ("Tyler, The Creator", "Simon & Garfunkel", "Chloe x Halle").
-- Collaborations are written "A, B", "A & B", "A feat. B", "A x B", "A with B" — those split.
-- Names on the protected list are kept whole. Add to the list as new cases show up.

CREATE TABLE IF NOT EXISTS public.protected_artist_names (name text PRIMARY KEY);
ALTER TABLE public.protected_artist_names ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.protected_artist_names FROM anon, authenticated;

INSERT INTO public.protected_artist_names (name) VALUES
  ('Tyler, The Creator'), ('Earth, Wind & Fire'), ('Crosby, Stills, Nash & Young'), ('Crosby, Stills & Nash'),
  ('Emerson, Lake & Palmer'), ('Blood, Sweat & Tears'), ('Peter, Paul and Mary'), ('Hello, Dolly'),
  ('Simon & Garfunkel'), ('Hall & Oates'), ('Daryl Hall & John Oates'), ('Kool & The Gang'), ('Brooks & Dunn'),
  ('Sam & Dave'), ('Ashford & Simpson'), ('Big & Rich'), ('Dan + Shay'), ('Florence + The Machine'),
  ('Mumford & Sons'), ('Iron & Wine'), ('Angus & Julia Stone'), ('Years & Years'), ('Above & Beyond'),
  ('Echo & the Bunnymen'), ('Bob Marley & The Wailers'), ('Tom Petty and the Heartbreakers'),
  ('Tom Petty & The Heartbreakers'), ('Huey Lewis & The News'), ('Katrina & The Waves'),
  ('Martha & The Vandellas'), ('Hootie & The Blowfish'), ('Prince & The Revolution'), ('Of Monsters and Men'),
  ('Marina and the Diamonds'), ('Edward Sharpe & The Magnetic Zeros'), ('Belle & Sebastian'),
  ('Chloe x Halle'), ('Silk Sonic'), ('Christine and the Queens'), ('Florence and the Machine'),
  ('Sly & The Family Stone'), ('Derek & The Dominos'), ('Siouxsie and the Banshees'), ('Gladys Knight & The Pips'),
  ('Smokey Robinson & The Miracles'), ('Diana Ross & The Supremes'), ('Ike & Tina Turner'),
  ('Kid Cudi & Eminem'), ('Nick Cave & The Bad Seeds'), ('Rubblebucket & Friends'), ('Polo & Pan'),
  ('Coheed and Cambria'), ('Matt and Kim'), ('Sofi Tukker'), ('Black Coffee'), ('Salt-N-Pepa'),
  ('Brandy & Monica'), ('Mary Mary'), ('Blackstreet'), ('Boyz II Men'), ('Me & My Monkey'),
  ('Jhené Aiko & Big Sean'), ('The Mamas & the Papas'), ('Bell Biv DeVoe'), ('Lion & The Lamb'),
  ('Lady A'), ('Thompson Square'), ('Maddie & Tae'), ('Brothers Osborne'), ('Johnnyswim'),
  ('Thirdstory'), ('Chase & Status'), ('Sigala & Ella Eyre'), ('Kaskade & Deadmau5'),
  ('Kanye West & Jay-Z'), ('Watch the Throne'), ('Jay-Z & Kanye West')
ON CONFLICT DO NOTHING;
-- (Collab names like "Kanye West & Jay-Z" aren't protected in practice: they're removed again below.)
DELETE FROM public.protected_artist_names WHERE name IN ('Kid Cudi & Eminem', 'Kanye West & Jay-Z', 'Jay-Z & Kanye West', 'Jhené Aiko & Big Sean', 'Sigala & Ella Eyre', 'Kaskade & Deadmau5', 'Brandy & Monica');

CREATE OR REPLACE FUNCTION public.split_artists(p_artist text)
RETURNS text[]
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  s text := coalesce(p_artist, '');
  n record;
  parts text[];
BEGIN
  -- 1. Shield protected names: swap their separators for placeholders
  FOR n IN SELECT name FROM protected_artist_names ORDER BY length(name) DESC LOOP
    IF position(lower(n.name) IN lower(s)) > 0 THEN
      s := regexp_replace(s, '(?i)' || regexp_replace(n.name, '([.*+?^${}()|\[\]\\])', '\\\1', 'g'),
             replace(replace(replace(replace(n.name, ',', '§c'), '&', '§a'), '+', '§p'), ' x ', ' §x '), 'g');
    END IF;
  END LOOP;
  -- 2. Split on collaboration separators
  s := regexp_replace(s, '\s+(feat\.?|ft\.?|featuring|with|&|x|vs\.?)\s+', ',', 'gi');
  parts := regexp_split_to_array(s, '\s*,\s*');
  -- 3. Restore the shielded characters, drop empties
  RETURN ARRAY(
    SELECT DISTINCT trim(replace(replace(replace(replace(p, '§c', ','), '§a', '&'), '§p', '+'), '§x', 'x'))
      FROM unnest(parts) p
     WHERE trim(p) <> ''
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.split_artists(text) TO authenticated, anon;
