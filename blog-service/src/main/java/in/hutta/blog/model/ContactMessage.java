package in.hutta.blog.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.Data;

@Entity
@Table(name = "contact_message")
@Data
public class ContactMessage {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(nullable = false, length = 100)
  private String email;

  @Column(nullable = false, length = 200)
  private String subject;

  @Column(nullable = false, columnDefinition = "TEXT")
  private String message;

  @Column(name = "created_at", nullable = false)
  private LocalDateTime createdAt;

  @Transient private String honeypot;

  @PrePersist
  protected void onCreate() {
    createdAt = LocalDateTime.now();
  }
}
