-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    sku VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    price NUMERIC(15,2) DEFAULT 0,
    sale_price NUMERIC(15,2),
    status VARCHAR(20) DEFAULT 'draft',
    stock_status VARCHAR(20) DEFAULT 'instock',
    is_visible BOOLEAN DEFAULT TRUE,
    seo_content JSONB,
    attributes JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- 2. Product Assets
CREATE TABLE IF NOT EXISTS product_assets (
    id UUID PRIMARY KEY,
    product_id UUID,
    file_path TEXT NOT NULL,
    file_type VARCHAR(10),
    is_main BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_product_assets_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    parent_id UUID,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon_url TEXT,
    sort_priority INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 4. Tags and mapping tables
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_category_map (
    product_id UUID,
    category_id UUID,
    PRIMARY KEY (product_id, category_id),
    CONSTRAINT fk_pcm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_pcm_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_tag_map (
    product_id UUID,
    tag_id UUID,
    PRIMARY KEY (product_id, tag_id),
    CONSTRAINT fk_ptm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_ptm_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 5. Optimization indexes
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
