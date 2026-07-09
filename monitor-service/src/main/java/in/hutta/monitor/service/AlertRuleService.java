package in.hutta.monitor.service;

import in.hutta.monitor.model.AlertEvent;
import in.hutta.monitor.model.AlertRule;
import in.hutta.monitor.repository.AlertEventRepository;
import in.hutta.monitor.repository.AlertRuleRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AlertRuleService {

  private final AlertRuleRepository ruleRepo;
  private final AlertEventRepository eventRepo;
  private final NtfyService ntfy;

  public List<AlertRule> findAll() {
    return ruleRepo.findAll();
  }

  public AlertRule save(AlertRule rule) {
    return ruleRepo.save(rule);
  }

  public AlertRule update(Long id, AlertRule updated) {
    AlertRule existing =
        ruleRepo
            .findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Rule not found: " + id));
    existing.setComponent(updated.getComponent());
    existing.setMetric(updated.getMetric());
    existing.setOperator(updated.getOperator());
    existing.setThreshold(updated.getThreshold());
    existing.setSeverity(updated.getSeverity());
    existing.setEnabled(updated.isEnabled());
    return ruleRepo.save(existing);
  }

  public void delete(Long id) {
    ruleRepo.deleteById(id);
  }

  public Page<AlertEvent> history(Pageable pageable) {
    return eventRepo.findAllByOrderByFiredAtDesc(pageable);
  }

  /**
   * Evaluate all enabled alert rules against the provided snapshot of metric values. Uses a
   * state-machine: fires once on first failure, resolves once on recovery.
   */
  @Transactional
  public void evaluate(Map<String, Object> snapshot) {
    List<AlertRule> rules = ruleRepo.findByEnabledTrue();
    for (AlertRule rule : rules) {
      String key = rule.getComponent() + "." + rule.getMetric();
      Object rawValue = snapshot.get(key);
      if (rawValue == null) continue;

      boolean failing = evaluateCondition(rawValue, rule.getOperator(), rule.getThreshold());
      List<AlertEvent> openEvents =
          eventRepo.findByComponentAndResolvedAtIsNull(rule.getComponent());

      if (failing && openEvents.isEmpty()) {
        // New failure — fire alert
        String msg =
            String.format(
                "[%s] %s %s %s %s (current: %s)",
                rule.getSeverity().toUpperCase(),
                rule.getComponent(),
                rule.getMetric(),
                rule.getOperator(),
                rule.getThreshold(),
                rawValue);
        AlertEvent event = new AlertEvent();
        event.setRule(rule);
        event.setComponent(rule.getComponent());
        event.setMessage(msg);
        event.setSeverity(rule.getSeverity());
        eventRepo.save(event);
        ntfy.send(
            "⚠️ Sentinel: " + rule.getComponent(),
            msg,
            rule.getSeverity(),
            "rotating_light,warning");
        log.warn("ALERT FIRED: {}", msg);

      } else if (!failing && !openEvents.isEmpty()) {
        // Recovery — resolve open events
        openEvents.forEach(
            e -> {
              e.setResolvedAt(Instant.now());
              eventRepo.save(e);
            });
        String msg =
            rule.getComponent() + " has recovered — " + rule.getMetric() + " is back to normal.";
        ntfy.send(
            "✅ Sentinel Resolved: " + rule.getComponent(), msg, "default", "white_check_mark");
        log.info("ALERT RESOLVED: {}", msg);
      }
    }
  }

  private boolean evaluateCondition(Object value, String operator, String threshold) {
    try {
      if ("!=".equals(operator) || "=".equals(operator)) {
        boolean eq = String.valueOf(value).trim().equalsIgnoreCase(threshold);
        return "!=".equals(operator) ? !eq : eq;
      }
      double numValue = Double.parseDouble(String.valueOf(value));
      double numThreshold = Double.parseDouble(threshold);
      return switch (operator) {
        case ">" -> numValue > numThreshold;
        case "<" -> numValue < numThreshold;
        case ">=" -> numValue >= numThreshold;
        case "<=" -> numValue <= numThreshold;
        default -> false;
      };
    } catch (Exception e) {
      return false;
    }
  }
}
