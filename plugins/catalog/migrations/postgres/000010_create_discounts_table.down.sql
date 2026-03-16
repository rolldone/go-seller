DROP TABLE IF EXISTS discounts;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type_enum') THEN
        DROP TYPE discount_type_enum;
    END IF;
END$$;
