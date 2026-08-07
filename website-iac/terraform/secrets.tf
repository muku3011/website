# ==============================================================================
# GCP Secret Manager Resources for hutta.in Platform
# Stores Keycloak admin passwords, PostgreSQL database credentials, and API keys
# ==============================================================================

resource "google_secret_manager_secret" "keycloak_master_credentials" {
  secret_id = "keycloak-master-admin-credentials"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "keycloak_realm_admin_credentials" {
  secret_id = "keycloak-hutta-admin-credentials"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "keycloak_realm_user_credentials" {
  secret_id = "keycloak-hutta-user-credentials"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "postgres_credentials" {
  secret_id = "postgres-db-credentials"
  replication {
    auto {}
  }
}

# Grant Secret Manager Secret Accessor role to the cluster Service Account
resource "google_secret_manager_secret_iam_member" "sa_keycloak_master_access" {
  secret_id = google_secret_manager_secret.keycloak_master_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ddns_updater.email}"
}

resource "google_secret_manager_secret_iam_member" "sa_keycloak_admin_access" {
  secret_id = google_secret_manager_secret.keycloak_realm_admin_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ddns_updater.email}"
}

resource "google_secret_manager_secret_iam_member" "sa_keycloak_user_access" {
  secret_id = google_secret_manager_secret.keycloak_realm_user_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ddns_updater.email}"
}

resource "google_secret_manager_secret_iam_member" "sa_postgres_access" {
  secret_id = google_secret_manager_secret.postgres_credentials.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.ddns_updater.email}"
}
