package in.hutta.hsm.repository;

import in.hutta.hsm.model.HsmSlot;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HsmSlotRepository extends JpaRepository<HsmSlot, Integer> {
  Optional<HsmSlot> findBySlotPin(String slotPin);

  boolean existsBySlotPin(String slotPin);
}
