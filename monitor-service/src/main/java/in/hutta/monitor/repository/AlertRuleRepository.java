package in.hutta.monitor.repository;

import in.hutta.monitor.model.AlertRule;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRuleRepository extends JpaRepository<AlertRule, Long> {
  List<AlertRule> findByEnabledTrue();
}
