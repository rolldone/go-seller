-- Migration: 000021_remove_discount_product_id.up.sql
-- Purpose: Remove legacy single-product column `product_id` from `discounts`.
-- Note: This drops the FK constraint and index if present. Existing product associations remain in `discount_products`.

ALTER TABLE discounts
    DROP CONSTRAINT IF EXISTS fk_discounts_product;

ALTER TABLE discounts
    DROP COLUMN IF EXISTS product_id;

DROP INDEX IF EXISTS idx_discounts_product_id;
