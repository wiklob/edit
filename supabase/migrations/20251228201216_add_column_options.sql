-- Add options column for select/multi-select column types
ALTER TABLE public.database_columns
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.database_columns.options IS 'JSON array of options for select/multi_select types. Format: [{"id": "uuid", "label": "Option", "color": "#hex"}]';
