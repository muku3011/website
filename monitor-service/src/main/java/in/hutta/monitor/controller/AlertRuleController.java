package in.hutta.monitor.controller;

import in.hutta.monitor.model.AlertEvent;
import in.hutta.monitor.model.AlertRule;
import in.hutta.monitor.service.AlertRuleService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AlertRuleController {

  private final AlertRuleService service;

  @GetMapping("/api/alert-rules")
  public List<AlertRule> listRules() {
    return service.findAll();
  }

  @PostMapping("/api/alert-rules")
  public AlertRule createRule(@RequestBody AlertRule rule) {
    return service.save(rule);
  }

  @PutMapping("/api/alert-rules/{id}")
  public AlertRule updateRule(@PathVariable Long id, @RequestBody AlertRule rule) {
    return service.update(id, rule);
  }

  @DeleteMapping("/api/alert-rules/{id}")
  public ResponseEntity<Void> deleteRule(@PathVariable Long id) {
    service.delete(id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/api/alert-history")
  public Page<AlertEvent> history(
      @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
    return service.history(PageRequest.of(page, size));
  }
}
