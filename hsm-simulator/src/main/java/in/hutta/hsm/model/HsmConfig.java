package in.hutta.hsm.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "hsm_config")
public class HsmConfig {

  @Id
  @Column(name = "config_key", length = 50)
  private String configKey;

  @Column(name = "config_value", nullable = false)
  private String configValue;

  public String getConfigKey() {
    return configKey;
  }

  public void setConfigKey(String configKey) {
    this.configKey = configKey;
  }

  public String getConfigValue() {
    return configValue;
  }

  public void setConfigValue(String configValue) {
    this.configValue = configValue;
  }
}
