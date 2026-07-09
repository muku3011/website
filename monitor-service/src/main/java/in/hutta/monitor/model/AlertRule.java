package in.hutta.monitor.model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Data;

@Entity
@Table(name = "alert_rules")
@Data
public class AlertRule {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 64)
  private String component;

  @Column(nullable = false, length = 64)
  private String metric;

  /** Comparison operator: >, <, !=, = */
  @Column(nullable = false, length = 8)
  private String operator = "!=";

  /** String-encoded threshold value (numeric or literal) */
  @Column(length = 64)
  private String threshold;

  /** Alert severity: high, default, low */
  @Column(nullable = false, length = 16)
  private String severity = "high";

  @Column(nullable = false)
  private boolean enabled = true;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt = Instant.now();
}
