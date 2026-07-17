package in.hutta.lpa.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import lombok.Data;

@Entity
@Data
public class LocalProfile {

  @Id private String iccid;

  private String smdpAddress;

  private String profileNickname;

  private String serviceProviderName;

  private String profileState; // "ENABLED" or "DISABLED"

  @Column(name = "sim_type")
  private String simType = "LPA"; // "LPA" or "IPA"

  @Lob
  @Column(columnDefinition = "TEXT")
  private String boundProfilePackage;
}
