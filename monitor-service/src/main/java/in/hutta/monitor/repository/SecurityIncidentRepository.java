package in.hutta.monitor.repository;

import in.hutta.monitor.model.SecurityIncident;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SecurityIncidentRepository extends JpaRepository<SecurityIncident, Long> {

  List<SecurityIncident> findTop100ByOrderByTimestampDesc();

  Optional<SecurityIncident> findFirstByIpAddressAndUsernameAndIncidentTypeOrderByTimestampDesc(
      String ipAddress, String username, String incidentType);

  @Query("SELECT COUNT(s) FROM SecurityIncident s WHERE s.ipAddress = ?1 AND s.incidentType = ?2")
  long countByIpAddressAndIncidentType(String ipAddress, String incidentType);
}
