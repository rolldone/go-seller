-- 000005_add_product_type.down.sql
ALTER TABLE products DROP COLUMN IF EXISTS product_type;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_type_enum') THEN
        DROP TYPE product_type_enum;
    END IF;
END$$;
