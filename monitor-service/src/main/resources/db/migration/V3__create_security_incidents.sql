CREATE TABLE security_incidents (
    id             BIGSERIAL PRIMARY KEY,
    ip_address     VARCHAR(45)  NOT NULL,
    username       VARCHAR(64),
    incident_type  VARCHAR(32)  NOT NULL,
    attempt_count  INT          NOT NULL DEFAULT 1,
    country        VARCHAR(64),
    country_code   VARCHAR(8),
    city           VARCHAR(64),
    details        TEXT,
    timestamp      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    blocked        BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_security_incidents_ip ON security_incidents(ip_address);
CREATE INDEX idx_security_incidents_timestamp ON security_incidents(timestamp DESC);
