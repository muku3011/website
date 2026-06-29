package in.hutta.ldap.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Entity
@Table(name = "authelia_user")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AutheliaUser {
    @Id
    private String username;

    @Column(name = "display_name", nullable = false)
    private String displayName;

    @Column(nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "authelia_user_group", joinColumns = @JoinColumn(name = "username"))
    @Column(name = "group_name")
    private Set<String> groups;
}
