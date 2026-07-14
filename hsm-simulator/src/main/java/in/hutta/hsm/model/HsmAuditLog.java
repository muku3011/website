package in.hutta.hsm.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "hsm_audit_logs")
public class HsmAuditLog {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  @Column(nullable = false)
  private String operation;

  @Column(name = "key_alias")
  private String keyAlias;

  @Column(nullable = false)
  private String status;

  @Column(length = 1000)
  private String details;

  @Column(nullable = false)
  private LocalDateTime timestamp = LocalDateTime.now();

  @Column(name = "slot_id")
  private Integer slotId = 1;

  public Integer getId() {
    return id;
  }

  public void setId(Integer id) {
    this.id = id;
  }

  public String getOperation() {
    return operation;
  }

  public void setOperation(String operation) {
    this.operation = operation;
  }

  public String getKeyAlias() {
    return keyAlias;
  }

  public void setKeyAlias(String keyAlias) {
    this.keyAlias = keyAlias;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getDetails() {
    return details;
  }

  public void setDetails(String details) {
    this.details = details;
  }

  public LocalDateTime getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(LocalDateTime timestamp) {
    this.timestamp = timestamp;
  }

  public Integer getSlotId() {
    return slotId;
  }

  public void setSlotId(Integer slotId) {
    this.slotId = slotId;
  }
}
