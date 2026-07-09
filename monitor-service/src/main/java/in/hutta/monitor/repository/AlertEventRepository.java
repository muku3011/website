package in.hutta.monitor.repository;

import in.hutta.monitor.model.AlertEvent;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertEventRepository extends JpaRepository<AlertEvent, Long> {
  Page<AlertEvent> findAllByOrderByFiredAtDesc(Pageable pageable);

  List<AlertEvent> findByComponentAndResolvedAtIsNull(String component);
}
