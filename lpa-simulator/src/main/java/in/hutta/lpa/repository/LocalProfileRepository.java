package in.hutta.lpa.repository;

import in.hutta.lpa.model.LocalProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LocalProfileRepository extends JpaRepository<LocalProfile, String> {}
