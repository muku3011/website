package in.hutta.monitor.model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Data;

@Entity
@Table(name = "security_incidents")
@Data
public class SecurityIncident {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "ip_address", nullable = false, length = 45)
  private String ipAddress;

  @Column(length = 64)
  private String username;

  @Column(name = "incident_type", nullable = false, length = 32)
  private String incidentType;

  @Column(name = "attempt_count", nullable = false)
  private int attemptCount = 1;

  @Column(length = 64)
  private String country;

  @Column(name = "country_code", length = 8)
  private String countryCode;

  @Column(length = 64)
  private String city;

  @Column(columnDefinition = "TEXT")
  private String details;

  @Column(nullable = false)
  private Instant timestamp = Instant.now();

  @Column(nullable = false)
  private boolean blocked = false;
}
