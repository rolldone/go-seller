-- data_search: full-text search index over products, businesses, categories

CREATE TABLE IF NOT EXISTS search_index (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type  VARCHAR(32)  NOT NULL,          -- 'product' | 'business' | 'category'
    entity_id    UUID         NOT NULL,
    title        TEXT         NOT NULL DEFAULT '',
    slug         TEXT         NOT NULL DEFAULT '',
    business_id  UUID,                            -- NULL for business/category rows
    search_vec   TSVECTOR     NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ,
    CONSTRAINT uq_search_index_entity UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_search_index_vec      ON search_index USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS idx_search_index_type     ON search_index (entity_type);
CREATE INDEX IF NOT EXISTS idx_search_index_business ON search_index (business_id);

-- ─── helper: refresh one product row ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_index_upsert_product(p products) RETURNS VOID AS $$
BEGIN
    INSERT INTO search_index (entity_type, entity_id, title, slug, business_id, search_vec, updated_at)
    VALUES (
        'product',
        p.id,
        COALESCE(p.name, ''),
        COALESCE(p.slug, ''),
        p.business_id,
        (
            setweight(to_tsvector('simple', COALESCE(p.name, '')),             'A') ||
            setweight(to_tsvector('simple', COALESCE(p.short_description, '')), 'B') ||
            setweight(to_tsvector('simple', COALESCE(p.description_plain, '')), 'C') ||
            setweight(to_tsvector('simple', COALESCE(
                p.seo_content::jsonb->>'description', ''
            )), 'D')
        ),
        NOW()
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        title       = EXCLUDED.title,
        slug        = EXCLUDED.slug,
        business_id = EXCLUDED.business_id,
        search_vec  = EXCLUDED.search_vec,
        updated_at  = NOW(),
        deleted_at  = NULL;
END;
$$ LANGUAGE plpgsql;

-- ─── helper: refresh one business row ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_index_upsert_business(b businesses) RETURNS VOID AS $$
BEGIN
    INSERT INTO search_index (entity_type, entity_id, title, slug, business_id, search_vec, updated_at)
    VALUES (
        'business',
        b.id,
        COALESCE(b.name, ''),
        COALESCE(b.slug, ''),
        NULL,
        (
            setweight(to_tsvector('simple', COALESCE(b.name, '')),              'A') ||
            setweight(to_tsvector('simple', COALESCE(b.short_description, '')), 'B') ||
            setweight(to_tsvector('simple', COALESCE(b.description_plain, '')), 'C')
        ),
        NOW()
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        title      = EXCLUDED.title,
        slug       = EXCLUDED.slug,
        search_vec = EXCLUDED.search_vec,
        updated_at = NOW(),
        deleted_at = NULL;
END;
$$ LANGUAGE plpgsql;

-- ─── helper: refresh one category row ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_index_upsert_category(cat categories) RETURNS VOID AS $$
BEGIN
    INSERT INTO search_index (entity_type, entity_id, title, slug, business_id, search_vec, updated_at)
    VALUES (
        'category',
        cat.id,
        COALESCE(cat.name, ''),
        COALESCE(cat.slug, ''),
        NULL,
        setweight(to_tsvector('simple', COALESCE(cat.name, '')), 'A'),
        NOW()
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        title      = EXCLUDED.title,
        slug       = EXCLUDED.slug,
        search_vec = EXCLUDED.search_vec,
        updated_at = NOW(),
        deleted_at = NULL;
END;
$$ LANGUAGE plpgsql;

-- ─── trigger functions ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_search_index_products() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR NEW.deleted_at IS NOT NULL THEN
        UPDATE search_index SET deleted_at = NOW(), updated_at = NOW()
         WHERE entity_type = 'product' AND entity_id = COALESCE(NEW.id, OLD.id);
    ELSE
        PERFORM search_index_upsert_product(NEW);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_search_index_businesses() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR NEW.deleted_at IS NOT NULL THEN
        UPDATE search_index SET deleted_at = NOW(), updated_at = NOW()
         WHERE entity_type = 'business' AND entity_id = COALESCE(NEW.id, OLD.id);
    ELSE
        PERFORM search_index_upsert_business(NEW);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_search_index_categories() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' OR NEW.deleted_at IS NOT NULL THEN
        UPDATE search_index SET deleted_at = NOW(), updated_at = NOW()
         WHERE entity_type = 'category' AND entity_id = COALESCE(NEW.id, OLD.id);
    ELSE
        PERFORM search_index_upsert_category(NEW);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: DB-level trigger attachment and automatic backfill have been intentionally
-- omitted/disabled here. We're keeping the helper upsert functions and trigger
-- function definitions for reference, but triggers and the DO-based backfill
-- are not created in this migration so indexing can be handled at the
-- application level instead.

-- To re-enable DB triggers and backfill, add CREATE TRIGGER statements and the
-- DO block (backfill) in a later migration or restore the removed lines.
