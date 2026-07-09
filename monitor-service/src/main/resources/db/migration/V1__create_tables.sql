CREATE TABLE alert_rules (
    id          BIGSERIAL PRIMARY KEY,
    component   VARCHAR(64)  NOT NULL,
    metric      VARCHAR(64)  NOT NULL,
    operator    VARCHAR(8)   NOT NULL DEFAULT '!=',
    threshold   VARCHAR(64),
    severity    VARCHAR(16)  NOT NULL DEFAULT 'high',
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE alert_events (
    id          BIGSERIAL PRIMARY KEY,
    rule_id     BIGINT REFERENCES alert_rules(id) ON DELETE SET NULL,
    component   VARCHAR(64)  NOT NULL,
    message     TEXT         NOT NULL,
    severity    VARCHAR(16)  NOT NULL,
    fired_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
