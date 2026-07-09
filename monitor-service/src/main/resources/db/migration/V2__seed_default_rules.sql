-- Seed 12 default alert rules covering all monitored components
INSERT INTO alert_rules (component, metric, operator, threshold, severity) VALUES
  -- Java Application Services
  ('smdp-plus',       'service_status',    '!=', 'active', 'high'),
  ('lpa-simulator',   'service_status',    '!=', 'active', 'high'),
  ('blog-service',    'service_status',    '!=', 'active', 'high'),
  ('keycloak',        'service_status',    '!=', 'active', 'high'),
  ('apache2',         'service_status',    '!=', 'active', 'high'),
  ('postgresql',      'service_status',    '!=', 'active', 'high'),
  -- SSL Certificates
  ('hutta.in',        'cert_days_left',    '<',  '30',     'default'),
  ('hutta.in',        'cert_days_left',    '<',  '14',     'high'),
  -- DNS Integrity
  ('dns',             'dns_mismatch',      '=',  'true',   'default'),
  -- System Resources
  ('system',          'mem_percent',       '>',  '90',     'default'),
  ('system',          'disk_percent',      '>',  '90',     'high'),
  ('system',          'cpuTempCelsius',    '>',  '80',     'default');
