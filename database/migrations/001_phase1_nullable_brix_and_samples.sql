BEGIN;

ALTER TABLE public.farm_lots
  ALTER COLUMN top_brix DROP NOT NULL,
  ALTER COLUMN bottom_brix DROP NOT NULL,
  ALTER COLUMN last_sampled DROP NOT NULL,
  ALTER COLUMN soil_moisture DROP NOT NULL,
  ALTER COLUMN soil_moisture DROP DEFAULT;

CREATE TABLE IF NOT EXISTS public.brix_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id VARCHAR(32) NOT NULL REFERENCES public.farm_lots(id) ON DELETE CASCADE,
  top_brix NUMERIC(4,1) NOT NULL,
  bottom_brix NUMERIC(4,1) NOT NULL,
  sampled_at DATE NOT NULL DEFAULT CURRENT_DATE,
  sampled_by VARCHAR(120) NOT NULL DEFAULT 'Field Officer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brix_samples_lot_date
  ON public.brix_samples (lot_id, sampled_at DESC);

ALTER TABLE public.brix_samples ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read brix_samples" ON public.brix_samples;
CREATE POLICY "Allow public read brix_samples"
  ON public.brix_samples FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert brix_samples" ON public.brix_samples;
CREATE POLICY "Allow public insert brix_samples"
  ON public.brix_samples FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update brix_samples" ON public.brix_samples;
CREATE POLICY "Allow public update brix_samples"
  ON public.brix_samples FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete brix_samples" ON public.brix_samples;
CREATE POLICY "Allow public delete brix_samples"
  ON public.brix_samples FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public delete access" ON public.farm_lots;
CREATE POLICY "Allow public delete access"
  ON public.farm_lots FOR DELETE USING (true);

INSERT INTO public.brix_samples (lot_id, top_brix, bottom_brix, sampled_at, sampled_by)
SELECT
  fl.id,
  fl.top_brix,
  fl.bottom_brix,
  COALESCE(fl.last_sampled, CURRENT_DATE),
  CASE
    WHEN fl.top_brix = 20.0 AND fl.bottom_brix = 20.5 THEN 'unverified (form default)'
    ELSE 'Backfilled initial sample'
  END
FROM public.farm_lots fl
WHERE fl.top_brix IS NOT NULL
  AND fl.bottom_brix IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.brix_samples bs WHERE bs.lot_id = fl.id
  );

COMMIT;
