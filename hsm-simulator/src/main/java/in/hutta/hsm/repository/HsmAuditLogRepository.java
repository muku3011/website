package in.hutta.hsm.repository;

import in.hutta.hsm.model.HsmAuditLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HsmAuditLogRepository extends JpaRepository<HsmAuditLog, Integer> {
  List<HsmAuditLog> findTop100ByOrderByTimestampDesc();

  List<HsmAuditLog> findTop100BySlotIdOrderByTimestampDesc(Integer slotId);
}
