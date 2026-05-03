-- RBAC tables for admin authorization.
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS admin_roles (
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        scope_business_id UUID,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- uniqueness: allow global (scope NULL) and scoped assignments
CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_roles_global
    ON admin_roles (admin_id, role_id)
    WHERE scope_business_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_roles_scoped
    ON admin_roles (admin_id, role_id, scope_business_id)
    WHERE scope_business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key ON role_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_admin_roles_admin_id ON admin_roles(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_role_id ON admin_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_scope_business_id ON admin_roles(scope_business_id);
