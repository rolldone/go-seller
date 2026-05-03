-- 000043_create_digital_files.up.sql
-- Stores downloadable files attached to digital products.
-- Access is gated: customers must have a paid order containing the product.

CREATE TABLE IF NOT EXISTS product_digital_files (
    id              UUID PRIMARY KEY,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_path       TEXT NOT NULL,
    file_name       TEXT NOT NULL DEFAULT '',
    mime_type       VARCHAR(100) NOT NULL DEFAULT '',
    file_size       BIGINT NOT NULL DEFAULT 0,
    download_limit  INT NOT NULL DEFAULT 0,  -- 0 = unlimited
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_product_digital_files_product_id ON product_digital_files(product_id);
CREATE INDEX IF NOT EXISTS idx_product_digital_files_deleted_at  ON product_digital_files(deleted_at);
