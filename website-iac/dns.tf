resource "google_dns_managed_zone" "hutta_zone" {
  name        = var.dns_zone_name
  dns_name    = "${var.domain_name}."
  description = "DNS zone for ${var.domain_name}"
}

resource "google_dns_record_set" "a_record" {
  name         = google_dns_managed_zone.hutta_zone.dns_name
  managed_zone = google_dns_managed_zone.hutta_zone.name
  type         = "A"
  ttl          = 300 # Shorter TTL is helpful for dynamic DNS
  rrdatas      = [var.initial_ip]

  lifecycle {
    ignore_changes = [rrdatas]
  }
}

resource "google_dns_record_set" "cname_record" {
  name         = "www.${google_dns_managed_zone.hutta_zone.dns_name}"
  managed_zone = google_dns_managed_zone.hutta_zone.name
  type         = "CNAME"
  ttl          = 300
  rrdatas      = [google_dns_managed_zone.hutta_zone.dns_name]
}

# auth.hutta.in — Keycloak subdomain
# CNAME to hutta.in so the existing DDNS script keeps both in sync automatically
resource "google_dns_record_set" "auth_cname" {
  name         = "auth.${google_dns_managed_zone.hutta_zone.dns_name}"
  managed_zone = google_dns_managed_zone.hutta_zone.name
  type         = "CNAME"
  ttl          = 300
  rrdatas      = [google_dns_managed_zone.hutta_zone.dns_name]
}
