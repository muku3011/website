package in.hutta.smdp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Profile {
  @Id private String iccid;
  private String eid;
  private String state; // AVAILABLE, ORDERED, RELEASED, DOWNLOADED, ENABLED
  private String networkType; // "4G" or "5G"

  @Column(columnDefinition = "TEXT")
  @jakarta.persistence.Convert(converter = in.hutta.smdp.util.CryptoConverter.class)
  private String profilePayload; // Base64 mock BPP or profile bytes

  @Column(name = "profile_class")
  private String profileClass;

  @Column(name = "mcc_mnc")
  private String mccMnc;

  @Column(name = "created_at")
  private java.time.LocalDateTime createdAt;

  @Column(name = "downloaded_at")
  private java.time.LocalDateTime downloadedAt;

  @Column(name = "order_id")
  private String orderId;

  @Column(name = "profile_type")
  private String profileType;
}
