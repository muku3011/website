package in.hutta.eim.repository;

import in.hutta.eim.model.EimAuditLog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EimAuditLogRepository extends JpaRepository<EimAuditLog, Long> {
  List<EimAuditLog> findAllByOrderByTimestampDesc();
}
