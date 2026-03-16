-- Fall back to the single product_id column and drop the mapping table.
UPDATE discounts d
SET product_id = dp.product_id
FROM (
    SELECT discount_id, MIN(product_id) AS product_id
    FROM discount_products
    GROUP BY discount_id
) dp
WHERE d.id = dp.discount_id AND d.product_id IS NULL;

DROP TABLE IF EXISTS discount_products;
