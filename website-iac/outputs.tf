output "name_servers" {
  description = "The DNS name servers assigned to the managed zone. You must configure these at domainz.in."
  value       = google_dns_managed_zone.hutta_zone.name_servers
}

output "ddns_private_key" {
  description = "The decoded JSON private key for the DDNS updater service account. Copy this to your Raspberry Pi."
  value       = base64decode(google_service_account_key.ddns_key.private_key)
  sensitive   = true
}
