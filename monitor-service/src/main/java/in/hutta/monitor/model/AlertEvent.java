package in.hutta.monitor.model;

import jakarta.persistence.*;
import java.time.Instant;
import lombok.Data;

@Entity
@Table(name = "alert_events")
@Data
public class AlertEvent {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "rule_id")
  private AlertRule rule;

  @Column(nullable = false, length = 64)
  private String component;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String message;

  @Column(nullable = false, length = 16)
  private String severity;

  @Column(name = "fired_at", nullable = false)
  private Instant firedAt = Instant.now();

  @Column(name = "resolved_at")
  private Instant resolvedAt;

  public boolean isResolved() {
    return resolvedAt != null;
  }
}
