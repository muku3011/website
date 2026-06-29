CREATE TABLE authelia_user (
    username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    CONSTRAINT pk_authelia_user PRIMARY KEY (username)
);

CREATE TABLE authelia_user_group (
    username VARCHAR(255) NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    CONSTRAINT pk_authelia_user_group PRIMARY KEY (username, group_name),
    CONSTRAINT fk_authelia_user_group_username FOREIGN KEY (username) REFERENCES authelia_user(username) ON DELETE CASCADE
);
