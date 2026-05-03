ALTER TABLE businesses
    DROP COLUMN IF EXISTS facebook,
    DROP COLUMN IF EXISTS instagram,
    DROP COLUMN IF EXISTS x_twitter,
    DROP COLUMN IF EXISTS tiktok;
