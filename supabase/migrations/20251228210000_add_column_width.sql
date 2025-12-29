-- Add width column to database_columns for resizable columns
-- Default width is 150px for most types, checkbox will be set to 80px in app logic

ALTER TABLE public.database_columns
ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT 150;

-- Add comment for documentation
COMMENT ON COLUMN public.database_columns.width IS 'Column width in pixels. Default 150px, checkbox type defaults to 80px.';
