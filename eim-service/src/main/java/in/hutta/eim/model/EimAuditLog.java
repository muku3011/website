package in.hutta.eim.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "eim_audit_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EimAuditLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private LocalDateTime timestamp;

  @Column(name = "actor_username", nullable = false)
  private String actorUsername;

  @Column(nullable = false)
  private String action; // DOWNLOAD, ENABLE, DISABLE, DELETE, REGISTER

  @Column(name = "target_eid")
  private String targetEid;

  @Column(name = "target_iccid")
  private String targetIccid;

  @Column(nullable = false)
  private String status; // SUCCESS, FAILED

  @Column(columnDefinition = "TEXT")
  private String details;
}
