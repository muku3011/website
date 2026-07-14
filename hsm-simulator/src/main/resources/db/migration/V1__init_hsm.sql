CREATE TABLE hsm_objects (
    id SERIAL PRIMARY KEY,
    alias VARCHAR(255) UNIQUE NOT NULL,
    object_type VARCHAR(50) NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    key_size INT,
    key_material BYTEA,
    certificate_data BYTEA,
    attributes VARCHAR(2000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hsm_audit_logs (
    id SERIAL PRIMARY KEY,
    operation VARCHAR(100) NOT NULL,
    key_alias VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    details VARCHAR(1000),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
