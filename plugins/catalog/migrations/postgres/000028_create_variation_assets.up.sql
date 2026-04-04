CREATE TABLE IF NOT EXISTS variation_assets (
    id UUID PRIMARY KEY,
    product_variation_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    is_main BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_variation_assets_variation
        FOREIGN KEY (product_variation_id) REFERENCES product_variations(id) ON DELETE CASCADE,
    CONSTRAINT fk_variation_assets_asset
        FOREIGN KEY (asset_id) REFERENCES product_assets(id) ON DELETE CASCADE,
    CONSTRAINT uq_variation_assets_combo UNIQUE (product_variation_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_variation_assets_variation ON variation_assets(product_variation_id);
CREATE INDEX IF NOT EXISTS idx_variation_assets_asset ON variation_assets(asset_id);
