DROP TRIGGER IF EXISTS t_search_products   ON products;
DROP TRIGGER IF EXISTS t_search_businesses ON businesses;
DROP TRIGGER IF EXISTS t_search_categories ON categories;

DROP FUNCTION IF EXISTS trg_search_index_products();
DROP FUNCTION IF EXISTS trg_search_index_businesses();
DROP FUNCTION IF EXISTS trg_search_index_categories();
DROP FUNCTION IF EXISTS search_index_upsert_product(products);
DROP FUNCTION IF EXISTS search_index_upsert_business(businesses);
DROP FUNCTION IF EXISTS search_index_upsert_category(categories);

DROP TABLE IF EXISTS search_index;
