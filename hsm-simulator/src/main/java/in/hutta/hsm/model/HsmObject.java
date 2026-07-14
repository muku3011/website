package in.hutta.hsm.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "hsm_objects")
public class HsmObject {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  @Column(unique = true, nullable = false)
  private String alias;

  @Column(name = "object_type", nullable = false)
  private String objectType;

  @Column(nullable = false)
  private String algorithm;

  @Column(name = "key_size")
  private Integer keySize;

  @Column(name = "key_material")
  private byte[] keyMaterial;

  @Column(name = "certificate_data")
  private byte[] certificateData;

  @Column(nullable = false, length = 2000)
  private String attributes;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt = LocalDateTime.now();

  @Column(name = "slot_id")
  private Integer slotId = 1;

  public Integer getId() {
    return id;
  }

  public void setId(Integer id) {
    this.id = id;
  }

  public String getAlias() {
    return alias;
  }

  public void setAlias(String alias) {
    this.alias = alias;
  }

  public String getObjectType() {
    return objectType;
  }

  public void setObjectType(String objectType) {
    this.objectType = objectType;
  }

  public String getAlgorithm() {
    return algorithm;
  }

  public void setAlgorithm(String algorithm) {
    this.algorithm = algorithm;
  }

  public Integer getKeySize() {
    return keySize;
  }

  public void setKeySize(Integer keySize) {
    this.keySize = keySize;
  }

  public byte[] getKeyMaterial() {
    return keyMaterial;
  }

  public void setKeyMaterial(byte[] keyMaterial) {
    this.keyMaterial = keyMaterial;
  }

  public byte[] getCertificateData() {
    return certificateData;
  }

  public void setCertificateData(byte[] certificateData) {
    this.certificateData = certificateData;
  }

  public String getAttributes() {
    return attributes;
  }

  public void setAttributes(String attributes) {
    this.attributes = attributes;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public Integer getSlotId() {
    return slotId;
  }

  public void setSlotId(Integer slotId) {
    this.slotId = slotId;
  }
}
