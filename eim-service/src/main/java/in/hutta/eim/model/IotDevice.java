package in.hutta.eim.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "iot_device")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class IotDevice {

  @Id private String eid;

  @Column(name = "device_name", nullable = false)
  private String deviceName;

  @Column(nullable = false)
  private String status; // ACTIVE, PROVISIONING, OFFLINE

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  @Column(name = "updated_at", nullable = false)
  private LocalDateTime updatedAt;
}
