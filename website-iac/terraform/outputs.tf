output "name_servers" {
  description = "The GCP Cloud DNS name servers assigned to the managed zone. Configure these at your domain registrar."
  value       = google_dns_managed_zone.hutta_zone.name_servers
}

output "service_account_email" {
  description = "The email of the created DDNS service account."
  value       = google_service_account.ddns_updater.email
}

output "ddns_private_key" {
  description = "The decoded JSON private key for the DDNS service account used in K8s secrets."
  value       = base64decode(google_service_account_key.ddns_key.private_key)
  sensitive   = true
}
