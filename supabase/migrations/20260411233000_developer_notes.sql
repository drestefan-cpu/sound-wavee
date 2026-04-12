CREATE TABLE IF NOT EXISTS public.developer_notes (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.developer_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "developer_notes_select_authenticated" ON public.developer_notes;
CREATE POLICY "developer_notes_select_authenticated"
ON public.developer_notes
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.developer_notes (id, content)
VALUES (1, '')
ON CONFLICT (id) DO NOTHING;
