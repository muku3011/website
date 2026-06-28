CREATE TABLE local_profile (
    iccid VARCHAR(255) NOT NULL,
    smdp_address VARCHAR(255),
    profile_nickname VARCHAR(255),
    service_provider_name VARCHAR(255),
    profile_state VARCHAR(255),
    bound_profile_package TEXT,
    CONSTRAINT pk_local_profile PRIMARY KEY (iccid)
);
