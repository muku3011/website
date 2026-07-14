-- Create hsm_slots table
CREATE TABLE hsm_slots (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    slot_pin VARCHAR(255) NOT NULL DEFAULT '1234',
    status VARCHAR(50) NOT NULL DEFAULT 'INITIALIZED'
);

-- Insert default slot
INSERT INTO hsm_slots (id, label, description, slot_pin, status)
VALUES (1, 'Default Slot', 'Default Cryptographic Token Slot', '1234', 'INITIALIZED');

-- Add slot_id column to hsm_objects
ALTER TABLE hsm_objects ADD COLUMN slot_id INT REFERENCES hsm_slots(id) DEFAULT 1;

-- Update existing objects to default slot
UPDATE hsm_objects SET slot_id = 1 WHERE slot_id IS NULL;

-- Remove unique constraint on alias and make slot_id + alias unique
ALTER TABLE hsm_objects DROP CONSTRAINT IF EXISTS hsm_objects_alias_key;
ALTER TABLE hsm_objects ADD CONSTRAINT hsm_objects_slot_id_alias_key UNIQUE (slot_id, alias);

-- Add slot_id column to hsm_audit_logs
ALTER TABLE hsm_audit_logs ADD COLUMN slot_id INT REFERENCES hsm_slots(id) DEFAULT 1;

-- Update existing audit logs to default slot
UPDATE hsm_audit_logs SET slot_id = 1 WHERE slot_id IS NULL;

-- Create hsm_config table
CREATE TABLE hsm_config (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL
);

-- Seed default admin and so pins
INSERT INTO hsm_config (config_key, config_value) VALUES ('admin_pin', 'admin123');
INSERT INTO hsm_config (config_key, config_value) VALUES ('so_pin', 'so123');
