-- Safety zones table
CREATE TABLE public.safety_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  zone_type text NOT NULL CHECK (zone_type IN ('safe','danger')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 200,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own zones all" ON public.safety_zones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add evidence_url column to alerts for photo capture
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS evidence_url text;

-- Evidence storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('evidence','evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "evidence read own" ON storage.objects FOR SELECT
  USING (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "evidence insert own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "evidence delete own" ON storage.objects FOR DELETE
  USING (bucket_id = 'evidence' AND auth.uid()::text = (storage.foldername(name))[1]);