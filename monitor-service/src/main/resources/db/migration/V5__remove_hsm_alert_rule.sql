-- Remove default alert rule for HSM Simulator
DELETE FROM alert_rules WHERE component = 'hsm-simulator';
