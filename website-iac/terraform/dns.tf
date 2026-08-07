# GCP Cloud DNS Managed Zone for hutta.in
resource "google_dns_managed_zone" "hutta_zone" {
  name        = var.dns_zone_name
  dns_name    = "${var.domain_name}."
  description = "Managed DNS zone for ${var.domain_name} platform & microservices"

  dnssec_config {
    state = "on"
  }
}

# Root A Record for hutta.in (Dynamic IP updated automatically by DDNS container)
resource "google_dns_record_set" "a_record" {
  name         = google_dns_managed_zone.hutta_zone.dns_name
  managed_zone = google_dns_managed_zone.hutta_zone.name
  type         = "A"
  ttl          = 300
  rrdatas      = [var.initial_ip]

  lifecycle {
    ignore_changes = [rrdatas]
  }
}

# WWW CNAME Record -> hutta.in
resource "google_dns_record_set" "cname_www" {
  name         = "www.${google_dns_managed_zone.hutta_zone.dns_name}"
  managed_zone = google_dns_managed_zone.hutta_zone.name
  type         = "CNAME"
  ttl          = 300
  rrdatas      = [google_dns_managed_zone.hutta_zone.dns_name]
}

# Keycloak Auth Subdomain CNAME Record (auth.hutta.in) -> hutta.in
resource "google_dns_record_set" "cname_auth" {
  name         = "auth.${google_dns_managed_zone.hutta_zone.dns_name}"
  managed_zone = google_dns_managed_zone.hutta_zone.name
  type         = "CNAME"
  ttl          = 300
  rrdatas      = [google_dns_managed_zone.hutta_zone.dns_name]
}

# Wildcard CNAME Record (*.hutta.in) -> hutta.in (Automatic routing for all subdomains)
resource "google_dns_record_set" "cname_wildcard" {
  name         = "*.${google_dns_managed_zone.hutta_zone.dns_name}"
  managed_zone = google_dns_managed_zone.hutta_zone.name
  type         = "CNAME"
  ttl          = 300
  rrdatas      = [google_dns_managed_zone.hutta_zone.dns_name]
}
