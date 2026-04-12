CREATE TABLE IF NOT EXISTS business_carousels (
	id UUID PRIMARY KEY,
	business_id UUID NOT NULL,
	slot VARCHAR(50) NOT NULL,
	title VARCHAR(255) NOT NULL DEFAULT '',
	subtitle TEXT,
	layout_type VARCHAR(20) NOT NULL DEFAULT 'large',
	is_active BOOLEAN NOT NULL DEFAULT TRUE,
	sort_order INTEGER NOT NULL DEFAULT 0,
	items JSONB NOT NULL DEFAULT '[]'::jsonb,
	created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TIMESTAMPTZ,
	CONSTRAINT fk_business_carousels_business
		FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_business_carousels_business_id ON business_carousels(business_id);
CREATE INDEX IF NOT EXISTS idx_business_carousels_business_active ON business_carousels(business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_business_carousels_business_sort ON business_carousels(business_id, sort_order);
