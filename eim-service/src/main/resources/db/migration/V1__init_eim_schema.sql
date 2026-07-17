CREATE TABLE iot_device (
    eid VARCHAR(255) NOT NULL,
    device_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT pk_iot_device PRIMARY KEY (eid)
);

CREATE TABLE eim_audit_log (
    id BIGSERIAL NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    actor_username VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_eid VARCHAR(255),
    target_iccid VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    details TEXT,
    CONSTRAINT pk_eim_audit_log PRIMARY KEY (id)
);
