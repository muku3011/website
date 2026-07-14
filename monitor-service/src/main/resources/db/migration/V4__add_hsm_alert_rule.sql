-- Seed default alert rule for HSM Simulator
INSERT INTO alert_rules (component, metric, operator, threshold, severity) VALUES
  ('hsm-simulator', 'service_status', '!=', 'active', 'high');
