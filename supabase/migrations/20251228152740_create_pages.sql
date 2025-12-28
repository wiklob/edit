-- ============================================================================
-- CREATE: Pages system (database pages, text pages, columns, properties)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create pages table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  database_type TEXT,
  name TEXT NOT NULL,
  content TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add constraints only if they don't exist (using DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pages_type_check'
  ) THEN
    ALTER TABLE public.pages ADD CONSTRAINT pages_type_check CHECK (type IN ('database', 'text'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pages_database_type_values_check'
  ) THEN
    ALTER TABLE public.pages ADD CONSTRAINT pages_database_type_values_check CHECK (database_type IS NULL OR database_type IN ('articles'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pages_database_type_check'
  ) THEN
    ALTER TABLE public.pages ADD CONSTRAINT pages_database_type_check CHECK (
      (type = 'database' AND database_type IS NOT NULL) OR
      (type = 'text' AND database_type IS NULL)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pages_parent_check'
  ) THEN
    ALTER TABLE public.pages ADD CONSTRAINT pages_parent_check CHECK (
      (type = 'database' AND parent_id IS NULL) OR
      (type = 'text')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pages_section ON public.pages(section_id);
CREATE INDEX IF NOT EXISTS idx_pages_parent ON public.pages(parent_id);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;

-- ============================================================================
-- STEP 2: Create database_columns table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.database_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'text',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_database_columns_page ON public.database_columns(page_id);

ALTER TABLE public.database_columns ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.database_columns TO authenticated;

-- ============================================================================
-- STEP 3: Create page_properties table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.page_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.database_columns(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'page_properties_page_id_column_id_key'
  ) THEN
    ALTER TABLE public.page_properties ADD CONSTRAINT page_properties_page_id_column_id_key UNIQUE(page_id, column_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_page_properties_page ON public.page_properties(page_id);
CREATE INDEX IF NOT EXISTS idx_page_properties_column ON public.page_properties(column_id);

ALTER TABLE public.page_properties ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_properties TO authenticated;

-- ============================================================================
-- STEP 4: Helper function to check section access
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_has_section_access(p_section_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User is workspace owner
    SELECT 1 FROM public.sections s
    JOIN public.workspaces w ON w.id = s.workspace_id
    WHERE s.id = p_section_id AND w.owner_id = auth.uid()
  ) OR EXISTS (
    -- User has explicit section access
    SELECT 1 FROM public.section_access sa
    JOIN public.workspace_members wm ON wm.id = sa.member_id
    WHERE sa.section_id = p_section_id AND wm.user_id = auth.uid()
  );
$$;

-- ============================================================================
-- STEP 5: RLS Policies for pages
-- ============================================================================

DROP POLICY IF EXISTS "pages_select" ON public.pages;
DROP POLICY IF EXISTS "pages_insert" ON public.pages;
DROP POLICY IF EXISTS "pages_update" ON public.pages;
DROP POLICY IF EXISTS "pages_delete" ON public.pages;

-- SELECT: User can see pages in sections they have access to
CREATE POLICY "pages_select" ON public.pages
  FOR SELECT USING (
    public.user_has_section_access(section_id)
  );

-- INSERT: User can create pages in sections they have access to
CREATE POLICY "pages_insert" ON public.pages
  FOR INSERT WITH CHECK (
    public.user_has_section_access(section_id)
  );

-- UPDATE: User can update pages in sections they have access to
CREATE POLICY "pages_update" ON public.pages
  FOR UPDATE USING (
    public.user_has_section_access(section_id)
  );

-- DELETE: Only workspace owner can delete pages
CREATE POLICY "pages_delete" ON public.pages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.sections s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE s.id = section_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: RLS Policies for database_columns
-- ============================================================================

DROP POLICY IF EXISTS "database_columns_select" ON public.database_columns;
DROP POLICY IF EXISTS "database_columns_insert" ON public.database_columns;
DROP POLICY IF EXISTS "database_columns_update" ON public.database_columns;
DROP POLICY IF EXISTS "database_columns_delete" ON public.database_columns;

-- SELECT: Can see columns for pages user can see
CREATE POLICY "database_columns_select" ON public.database_columns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_has_section_access(p.section_id)
    )
  );

-- INSERT: Can create columns for pages user can access
CREATE POLICY "database_columns_insert" ON public.database_columns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_has_section_access(p.section_id)
    )
  );

-- UPDATE: Can update columns for pages user can access
CREATE POLICY "database_columns_update" ON public.database_columns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_has_section_access(p.section_id)
    )
  );

-- DELETE: Only workspace owner can delete columns
CREATE POLICY "database_columns_delete" ON public.database_columns
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      JOIN public.sections s ON s.id = p.section_id
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE p.id = page_id AND w.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 7: RLS Policies for page_properties
-- ============================================================================

DROP POLICY IF EXISTS "page_properties_select" ON public.page_properties;
DROP POLICY IF EXISTS "page_properties_insert" ON public.page_properties;
DROP POLICY IF EXISTS "page_properties_update" ON public.page_properties;
DROP POLICY IF EXISTS "page_properties_delete" ON public.page_properties;

-- SELECT: Can see properties for pages user can see
CREATE POLICY "page_properties_select" ON public.page_properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_has_section_access(p.section_id)
    )
  );

-- INSERT: Can create properties for pages user can access
CREATE POLICY "page_properties_insert" ON public.page_properties
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_has_section_access(p.section_id)
    )
  );

-- UPDATE: Can update properties for pages user can access
CREATE POLICY "page_properties_update" ON public.page_properties
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_has_section_access(p.section_id)
    )
  );

-- DELETE: Can delete properties for pages user can access
CREATE POLICY "page_properties_delete" ON public.page_properties
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = page_id AND public.user_has_section_access(p.section_id)
    )
  );

-- ============================================================================
-- STEP 8: Trigger to auto-create columns for "articles" database
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_articles_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'database' AND NEW.database_type = 'articles' THEN
    INSERT INTO public.database_columns (page_id, name, property_type, display_order)
    VALUES
      (NEW.id, 'Title', 'text', 0),
      (NEW.id, 'Author', 'text', 1),
      (NEW.id, 'Publication Date', 'text', 2);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_database_page_created ON public.pages;
CREATE TRIGGER on_database_page_created
  AFTER INSERT ON public.pages
  FOR EACH ROW
  WHEN (NEW.type = 'database')
  EXECUTE FUNCTION public.create_articles_columns();

-- ============================================================================
-- STEP 9: Trigger to auto-create properties for text pages in database
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_page_properties()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'text' AND NEW.parent_id IS NOT NULL THEN
    INSERT INTO public.page_properties (page_id, column_id, value)
    SELECT NEW.id, dc.id, NULL
    FROM public.database_columns dc
    WHERE dc.page_id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_text_page_created ON public.pages;
CREATE TRIGGER on_text_page_created
  AFTER INSERT ON public.pages
  FOR EACH ROW
  WHEN (NEW.type = 'text' AND NEW.parent_id IS NOT NULL)
  EXECUTE FUNCTION public.create_page_properties();

-- ============================================================================
-- DONE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Created pages system:';
  RAISE NOTICE '  - pages table with RLS';
  RAISE NOTICE '  - database_columns table with RLS';
  RAISE NOTICE '  - page_properties table with RLS';
  RAISE NOTICE '  - Auto-create columns for articles database';
  RAISE NOTICE '  - Auto-create properties for text pages';
END $$;
