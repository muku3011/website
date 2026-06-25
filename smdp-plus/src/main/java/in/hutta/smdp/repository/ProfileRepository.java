package in.hutta.smdp.repository;

import in.hutta.smdp.model.Profile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProfileRepository extends JpaRepository<Profile, String> {
    Optional<Profile> findFirstByState(String state);
    Optional<Profile> findByEidAndState(String eid, String state);
}
