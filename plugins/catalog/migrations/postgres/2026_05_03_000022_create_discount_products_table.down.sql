-- Fall back to the single product_id column and drop the mapping table.
ALTER TABLE discounts ADD COLUMN IF NOT EXISTS product_id UUID;

UPDATE discounts d
SET product_id = dp.product_id
FROM (
    SELECT discount_id, MIN(product_id::text)::uuid AS product_id
    FROM discount_products
    GROUP BY discount_id
) dp
WHERE d.id = dp.discount_id AND d.product_id IS NULL;

DROP TABLE IF EXISTS discount_products;
