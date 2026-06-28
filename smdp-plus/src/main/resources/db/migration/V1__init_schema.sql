CREATE TABLE profile (
    iccid VARCHAR(255) NOT NULL,
    eid VARCHAR(255),
    state VARCHAR(255),
    profile_payload TEXT,
    CONSTRAINT pk_profile PRIMARY KEY (iccid)
);
