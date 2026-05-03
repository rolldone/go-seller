ALTER TABLE products
    DROP COLUMN IF EXISTS weight,
    DROP COLUMN IF EXISTS dimensions_length,
    DROP COLUMN IF EXISTS dimensions_width,
    DROP COLUMN IF EXISTS dimensions_height;