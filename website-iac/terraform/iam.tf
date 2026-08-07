# Service Account for Dynamic DNS & cert-manager
resource "google_service_account" "ddns_updater" {
  account_id   = "ddns-updater"
  display_name = "Dynamic DNS & cert-manager Service Account"
  description  = "Service account used by K3s cluster to update GCP Cloud DNS A records and perform ACME DNS-01 challenges"
}

# Least Privilege: Restrict permissions ONLY to the specific DNS Managed Zone
resource "google_dns_managed_zone_iam_member" "dns_zone_admin" {
  project      = var.project_id
  managed_zone = google_dns_managed_zone.hutta_zone.name
  role         = "roles/dns.admin"
  member       = "serviceAccount:${google_service_account.ddns_updater.email}"
}

# Create Service Account JSON Key
resource "google_service_account_key" "ddns_key" {
  service_account_id = google_service_account.ddns_updater.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}
