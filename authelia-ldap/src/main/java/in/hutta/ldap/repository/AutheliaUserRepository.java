package in.hutta.ldap.repository;

import in.hutta.ldap.model.AutheliaUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AutheliaUserRepository extends JpaRepository<AutheliaUser, String> {
}
