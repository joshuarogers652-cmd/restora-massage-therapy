-- OPTIONAL fictional demo data for local testing or a staging site.
-- Never run this on the live business database.
-- Run it after the API has created the tables (open /api/health once first).
--
-- Adds one fictional therapist who becomes active when someone signs in with
-- demo.therapist@example.com, qualified for every service and enhancement,
-- working Monday–Saturday 9:00–17:00, and sample prices for the enhancements.

INSERT INTO therapists (invite_email, display_name, bio_en, bio_es, license_number, license_expires_on)
SELECT 'demo.therapist@example.com', 'Demo Therapist', 'Fictional therapist for testing.', 'Terapeuta ficticio para pruebas.', 'DEMO-0000', current_date + 365
WHERE NOT EXISTS (SELECT 1 FROM therapists WHERE invite_email = 'demo.therapist@example.com');

INSERT INTO therapist_services (therapist_id, service_id)
SELECT t.id, s.id FROM therapists t CROSS JOIN services s WHERE t.invite_email = 'demo.therapist@example.com'
ON CONFLICT DO NOTHING;

INSERT INTO therapist_enhancements (therapist_id, enhancement_id, certification, verified_on)
SELECT t.id, e.id, CASE WHEN e.requires_qualification THEN 'Demo certification (fictional)' END, current_date
FROM therapists t CROSS JOIN enhancements e WHERE t.invite_email = 'demo.therapist@example.com'
ON CONFLICT DO NOTHING;

INSERT INTO therapist_hours (therapist_id, weekday, start_minute, end_minute)
SELECT t.id, d, 540, 1020 FROM therapists t CROSS JOIN generate_series(1, 6) AS d
WHERE t.invite_email = 'demo.therapist@example.com'
  AND NOT EXISTS (SELECT 1 FROM therapist_hours h WHERE h.therapist_id = t.id);

UPDATE enhancements SET added_minutes = 15, price_cents = 2000 WHERE slug = 'face-massage' AND price_cents IS NULL;
UPDATE enhancements SET added_minutes = 15, price_cents = 1500 WHERE slug = 'foot-scrub' AND price_cents IS NULL;
UPDATE enhancements SET added_minutes = 15, price_cents = 2500 WHERE slug = 'dynamic-cupping' AND price_cents IS NULL;
