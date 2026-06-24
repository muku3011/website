resource "google_service_account" "ddns_updater" {
  account_id   = "ddns-updater"
  display_name = "Dynamic DNS Updater Service Account"
}

resource "google_dns_managed_zone_iam_member" "dns_zone_admin" {
  project      = var.project_id
  managed_zone = google_dns_managed_zone.hutta_zone.name
  role         = "roles/dns.admin"
  member       = "serviceAccount:${google_service_account.ddns_updater.email}"
}

resource "google_service_account_key" "ddns_key" {
  service_account_id = google_service_account.ddns_updater.name
  public_key_type    = "TYPE_X509_PEM_FILE"
}
