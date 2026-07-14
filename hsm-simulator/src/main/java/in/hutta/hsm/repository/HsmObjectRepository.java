package in.hutta.hsm.repository;

import in.hutta.hsm.model.HsmObject;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HsmObjectRepository extends JpaRepository<HsmObject, Integer> {
  Optional<HsmObject> findBySlotIdAndAlias(Integer slotId, String alias);

  boolean existsBySlotIdAndAlias(Integer slotId, String alias);

  List<HsmObject> findBySlotId(Integer slotId);

  Optional<HsmObject> findByAlias(String alias);

  boolean existsByAlias(String alias);
}
