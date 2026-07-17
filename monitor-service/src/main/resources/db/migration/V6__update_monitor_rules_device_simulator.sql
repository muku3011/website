-- Update lpa-simulator rules to device-simulator and seed eim-service rules
UPDATE alert_rules SET component = 'device-simulator' WHERE component = 'lpa-simulator';

INSERT INTO alert_rules (component, metric, operator, threshold, severity) VALUES
  ('eim-service', 'service_status', '!=', 'active', 'high');
