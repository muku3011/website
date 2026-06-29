package in.hutta.smdp.repository;

import in.hutta.smdp.model.Profile;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProfileRepository extends JpaRepository<Profile, String> {
  Optional<Profile> findFirstByState(String state);

  Optional<Profile> findByEidAndState(String eid, String state);

  List<Profile> findAllByState(String state);
}
