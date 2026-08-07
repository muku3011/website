variable "project_id" {
  type        = string
  description = "The GCP Project ID where resources will be created."
}

variable "region" {
  type        = string
  description = "The GCP region for the provider."
  default     = "europe-north1"
}

variable "domain_name" {
  type        = string
  description = "The domain name to manage."
  default     = "hutta.in"
}

variable "dns_zone_name" {
  type        = string
  description = "The name of the DNS managed zone in GCP."
  default     = "hutta-in-zone"
}

variable "initial_ip" {
  type        = string
  description = "The initial public IP of the Raspberry Pi. Defaults to loopback since DDNS will update it automatically."
  default     = "127.0.0.1"
}
