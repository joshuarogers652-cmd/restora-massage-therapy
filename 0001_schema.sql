-- RESTORA Massage Therapy — initial schema (PostgreSQL 14+)
-- Applied automatically by the API on first start (see api/src/database/migrate.ts).
--
-- Sensitive health and clinical content (intake answers, areas of concern,
-- contraindication flags and review rationale, SOAP notes) is stored ENCRYPTED
-- by the API (AES-256-GCM, columns ending in _enc). Azure Database for PostgreSQL
-- also encrypts all data at rest.
-- Money = integer cents. Times = timestamptz (UTC).

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- must be allow-listed on Azure (azure.extensions)
CREATE EXTENSION IF NOT EXISTS pgcrypto;     -- gen_random_uuid()

-- ─────────────── Identity ───────────────
CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_provider  text NOT NULL,
  provider_user_id   text NOT NULL,
  email              text,
  display_name       text,
  preferred_locale   text NOT NULL DEFAULT 'en' CHECK (preferred_locale IN ('en','es')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  last_login_at      timestamptz,
  disabled_at        timestamptz,
  UNIQUE (identity_provider, provider_user_id)
);
CREATE INDEX users_email_idx ON users (lower(email));

CREATE TABLE user_roles (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('client','therapist','office_manager','admin')),
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE clients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid UNIQUE REFERENCES users(id),
  first_name       text NOT NULL,
  last_name        text NOT NULL,
  preferred_name   text,
  email            text,
  phone            text,
  date_of_birth    date,
  email_opt_in     boolean NOT NULL DEFAULT true,
  sms_opt_in       boolean NOT NULL DEFAULT false,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clients_name_idx ON clients (lower(last_name), lower(first_name));

CREATE TABLE therapists (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid UNIQUE REFERENCES users(id),
  invite_email        text,               -- links the therapist to a user on first sign-in
  display_name        text NOT NULL,
  bio_en              text,
  bio_es              text,
  license_number      text,
  license_expires_on  date,
  active              boolean NOT NULL DEFAULT true,
  accepts_new_clients boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────── Catalog ───────────────
CREATE TABLE services (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name_en           text NOT NULL,
  name_es           text NOT NULL,
  summary_en        text NOT NULL,
  summary_es        text NOT NULL,
  description_en    text NOT NULL,
  description_es    text NOT NULL,
  expect_en         jsonb NOT NULL DEFAULT '[]',
  expect_es         jsonb NOT NULL DEFAULT '[]',
  benefits_en       jsonb NOT NULL DEFAULT '[]',
  benefits_es       jsonb NOT NULL DEFAULT '[]',
  candidates_en     jsonb NOT NULL DEFAULT '[]',
  candidates_es     jsonb NOT NULL DEFAULT '[]',
  notes_en          jsonb NOT NULL DEFAULT '[]',
  notes_es          jsonb NOT NULL DEFAULT '[]',
  pressure_options  text[] NOT NULL DEFAULT '{LIGHT,MEDIUM,FIRM}',
  requires_consents text[] NOT NULL DEFAULT '{GENERAL_TREATMENT}',
  active            boolean NOT NULL DEFAULT true,
  sort_order        int NOT NULL DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE service_durations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  minutes     int NOT NULL CHECK (minutes BETWEEN 15 AND 240),
  price_cents int CHECK (price_cents IS NULL OR price_cents >= 0),   -- NULL = not priced yet, not bookable online
  active      boolean NOT NULL DEFAULT true,
  UNIQUE (service_id, minutes)
);

CREATE TABLE enhancements (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                   text NOT NULL UNIQUE,
  name_en                text NOT NULL,
  name_es                text NOT NULL,
  description_en         text NOT NULL,
  description_es         text NOT NULL,
  benefits_en            jsonb NOT NULL DEFAULT '[]',
  benefits_es            jsonb NOT NULL DEFAULT '[]',
  requirements_en        jsonb NOT NULL DEFAULT '[]',
  requirements_es        jsonb NOT NULL DEFAULT '[]',
  added_minutes          int CHECK (added_minutes IS NULL OR added_minutes BETWEEN 0 AND 120),
  price_cents            int CHECK (price_cents IS NULL OR price_cents >= 0),
  requires_consents      text[] NOT NULL DEFAULT '{}',
  requires_qualification boolean NOT NULL DEFAULT false,
  active                 boolean NOT NULL DEFAULT true,
  sort_order             int NOT NULL DEFAULT 0,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE screening_items (
  code     text PRIMARY KEY,
  label_en text NOT NULL,
  label_es text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

-- Category per service/enhancement. Must be reviewed by a qualified professional.
CREATE TABLE service_screening (
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  code       text NOT NULL REFERENCES screening_items(code),
  category   text NOT NULL CHECK (category IN ('POSTPONE_OR_REFER','MODIFY_TREATMENT','CLEARANCE_REQUIRED')),
  PRIMARY KEY (service_id, code)
);
CREATE TABLE enhancement_screening (
  enhancement_id uuid NOT NULL REFERENCES enhancements(id) ON DELETE CASCADE,
  code           text NOT NULL REFERENCES screening_items(code),
  category       text NOT NULL CHECK (category IN ('POSTPONE_OR_REFER','MODIFY_TREATMENT','CLEARANCE_REQUIRED')),
  PRIMARY KEY (enhancement_id, code)
);

CREATE TABLE enhancement_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           text NOT NULL CHECK (kind IN ('SERVICE_BLOCKS_ENHANCEMENT','ENHANCEMENTS_INCOMPATIBLE')),
  service_id     uuid REFERENCES services(id) ON DELETE CASCADE,
  enhancement_a  uuid NOT NULL REFERENCES enhancements(id) ON DELETE CASCADE,
  enhancement_b  uuid REFERENCES enhancements(id) ON DELETE CASCADE,
  reason_en      text NOT NULL,
  reason_es      text NOT NULL,
  CHECK ((kind = 'SERVICE_BLOCKS_ENHANCEMENT' AND service_id IS NOT NULL AND enhancement_b IS NULL)
      OR (kind = 'ENHANCEMENTS_INCOMPATIBLE' AND service_id IS NULL AND enhancement_b IS NOT NULL))
);

-- ─────────────── Therapist qualifications & schedule ───────────────
CREATE TABLE therapist_services (
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  service_id   uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (therapist_id, service_id)
);
CREATE TABLE therapist_enhancements (
  therapist_id   uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  enhancement_id uuid NOT NULL REFERENCES enhancements(id) ON DELETE CASCADE,
  certification  text,
  verified_on    date,
  PRIMARY KEY (therapist_id, enhancement_id)
);
CREATE TABLE therapist_hours (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  weekday      int NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0 = Sunday
  start_minute int NOT NULL CHECK (start_minute BETWEEN 0 AND 1440),
  end_minute   int NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
  CHECK (end_minute > start_minute)
);
CREATE INDEX therapist_hours_idx ON therapist_hours (therapist_id, weekday);

-- therapist_id NULL = the whole business is closed (holiday / blocked date)
CREATE TABLE time_off (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid REFERENCES therapists(id) ON DELETE CASCADE,
  starts_at    timestamptz NOT NULL,
  ends_at      timestamptz NOT NULL,
  reason       text,
  CHECK (ends_at > starts_at)
);
CREATE INDEX time_off_range_idx ON time_off (starts_at, ends_at);

-- ─────────────── Promotions & gift cards ───────────────
CREATE TABLE promotions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  title_en        text NOT NULL,
  title_es        text NOT NULL,
  discount_type   text NOT NULL CHECK (discount_type IN ('PERCENT','FIXED_CENTS')),
  discount_value  int NOT NULL CHECK (discount_value > 0),
  starts_on       date NOT NULL,
  ends_on         date NOT NULL,
  max_redemptions int,
  redemptions     int NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_type <> 'PERCENT' OR discount_value <= 100)
);

CREATE TABLE gift_cards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash      text NOT NULL UNIQUE,     -- SHA-256 of the code; the code itself is shown once
  last4          text NOT NULL,
  initial_cents  int NOT NULL CHECK (initial_cents > 0),
  balance_cents  int NOT NULL CHECK (balance_cents >= 0),
  recipient_name text,
  recipient_email text,
  expires_on     date,
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  disabled_at    timestamptz
);

-- ─────────────── Appointments ───────────────
CREATE TABLE appointments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid NOT NULL REFERENCES clients(id),
  therapist_id      uuid NOT NULL REFERENCES therapists(id),
  service_id        uuid NOT NULL REFERENCES services(id),
  duration_id       uuid NOT NULL REFERENCES service_durations(id),
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz NOT NULL,
  block_ends_at     timestamptz NOT NULL,    -- ends_at + cleanup buffer; used for overlap checks
  status            text NOT NULL CHECK (status IN
                      ('HELD','PENDING_REVIEW','CONFIRMED','CHECKED_IN','COMPLETED',
                       'CANCELLED_BY_CLIENT','CANCELLED_BY_BUSINESS','NO_SHOW','RESCHEDULED','EXPIRED')),
  hold_expires_at   timestamptz,
  pressure          text CHECK (pressure IN ('LIGHT','MEDIUM','FIRM')),
  subtotal_cents    int NOT NULL,
  discount_cents    int NOT NULL DEFAULT 0,
  total_cents       int NOT NULL,
  amount_due_now_cents int NOT NULL DEFAULT 0,
  promotion_id      uuid REFERENCES promotions(id),
  flagged_count     int NOT NULL DEFAULT 0,  -- number of screening flags (details are encrypted)
  rescheduled_from  uuid UNIQUE REFERENCES appointments(id),
  cancelled_at      timestamptz,
  cancelled_by      uuid REFERENCES users(id),
  cancel_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at AND block_ends_at >= ends_at),
  -- Database-level double-booking prevention. Any overlapping active appointment
  -- for the same therapist is rejected with SQLSTATE 23P01.
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    therapist_id WITH =,
    tstzrange(starts_at, block_ends_at, '[)') WITH &&
  ) WHERE (status IN ('HELD','PENDING_REVIEW','CONFIRMED','CHECKED_IN'))
);
CREATE INDEX appointments_therapist_time_idx ON appointments (therapist_id, starts_at);
CREATE INDEX appointments_client_idx ON appointments (client_id, starts_at);
CREATE INDEX appointments_status_idx ON appointments (status);

CREATE TABLE appointment_enhancements (
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  enhancement_id uuid NOT NULL REFERENCES enhancements(id),
  price_cents    int NOT NULL,
  added_minutes  int NOT NULL,
  PRIMARY KEY (appointment_id, enhancement_id)
);

-- ─────────────── Intake & screening (encrypted content) ───────────────
CREATE TABLE intakes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version    int NOT NULL,
  data_enc   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, version)
);

CREATE TABLE appointment_intakes (
  appointment_id uuid PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
  intake_id      uuid NOT NULL REFERENCES intakes(id),
  concerns_enc   text NOT NULL,   -- body areas, answers to the visit questions
  flags_enc      text NOT NULL    -- [{code, category, source}]
);

CREATE TABLE contraindication_reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  reviewer_id    uuid NOT NULL REFERENCES users(id),
  decision       text NOT NULL CHECK (decision IN ('PROCEED','PROCEED_WITH_MODIFICATIONS','POSTPONE','REFER','CLEARANCE_REQUESTED')),
  rationale_enc  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_appt_idx ON contraindication_reviews (appointment_id);

-- ─────────────── Consent ───────────────
CREATE TABLE consent_forms (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind      text NOT NULL CHECK (kind IN ('GENERAL_TREATMENT','AROMATHERAPY','DYNAMIC_CUPPING','PRENATAL','CANCELLATION_POLICY')),
  version   int NOT NULL,
  title_en  text NOT NULL,
  title_es  text NOT NULL,
  body_en   text NOT NULL,
  body_es   text NOT NULL,
  active    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, version)
);
CREATE UNIQUE INDEX consent_forms_one_active ON consent_forms (kind) WHERE active;

CREATE TABLE consent_signatures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  consent_form_id uuid NOT NULL REFERENCES consent_forms(id),
  appointment_id  uuid REFERENCES appointments(id) ON DELETE SET NULL,
  signed_name     text NOT NULL,
  signed_at       timestamptz NOT NULL DEFAULT now(),
  ip_address      text
);
CREATE INDEX consent_sig_client_idx ON consent_signatures (client_id);

-- ─────────────── SOAP notes (encrypted content) ───────────────
CREATE TABLE soap_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  body       jsonb NOT NULL,    -- {subjective, objective, assessment, plan} prompts, no client data
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE soap_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  uuid NOT NULL UNIQUE REFERENCES appointments(id),
  client_id       uuid NOT NULL REFERENCES clients(id),
  therapist_id    uuid NOT NULL REFERENCES therapists(id),
  status          text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SIGNED')),
  content_enc     text NOT NULL,
  amendment_count int NOT NULL DEFAULT 0,
  draft_saved_at  timestamptz,
  signed_at       timestamptz,
  signature_name  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX soap_client_idx ON soap_notes (client_id, created_at);

CREATE TABLE soap_amendments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soap_note_id  uuid NOT NULL REFERENCES soap_notes(id) ON DELETE RESTRICT,
  author_id     uuid NOT NULL REFERENCES users(id),
  reason        text NOT NULL,
  previous_enc  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Signed notes can only change through an amendment (which bumps amendment_count).
CREATE FUNCTION soap_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'SIGNED' THEN
    IF NEW.status <> 'SIGNED' THEN
      RAISE EXCEPTION 'A signed SOAP note cannot be returned to draft';
    END IF;
    IF NEW.content_enc IS DISTINCT FROM OLD.content_enc AND NEW.amendment_count <> OLD.amendment_count + 1 THEN
      RAISE EXCEPTION 'Signed SOAP notes can only be changed through an amendment';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER soap_notes_guard BEFORE UPDATE ON soap_notes FOR EACH ROW EXECUTE FUNCTION soap_guard();

-- ─────────────── Payments ───────────────
CREATE TABLE payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id           uuid REFERENCES appointments(id),
  client_id                uuid REFERENCES clients(id),
  kind                     text NOT NULL CHECK (kind IN ('DEPOSIT','FULL','BALANCE','GIFT_CARD_PURCHASE')),
  status                   text NOT NULL CHECK (status IN ('REQUIRES_PAYMENT','PROCESSING','SUCCEEDED','FAILED','CANCELLED','PARTIALLY_REFUNDED','REFUNDED')),
  amount_cents             int NOT NULL CHECK (amount_cents >= 0),
  refunded_cents           int NOT NULL DEFAULT 0,
  currency                 text NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id text UNIQUE,
  receipt_url              text,
  failure_reason           text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_appt_idx ON payments (appointment_id);

CREATE TABLE refunds (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       uuid NOT NULL REFERENCES payments(id),
  amount_cents     int NOT NULL CHECK (amount_cents > 0),
  reason           text NOT NULL,
  status           text NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','FAILED','NEEDS_MANUAL')),
  stripe_refund_id text UNIQUE,
  issued_by        uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Verified Stripe events, so a retried webhook is processed once.
CREATE TABLE webhook_events (
  id          text PRIMARY KEY,
  type        text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- ─────────────── Communication & requests ───────────────
CREATE TABLE contact_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  phone      text,
  topic      text NOT NULL,
  message    text NOT NULL,
  locale     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz,
  handled_by uuid REFERENCES users(id)
);

CREATE TABLE records_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id),
  details      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid REFERENCES users(id),
  notes        text
);

-- Notification bodies never include health details.
CREATE TABLE notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid REFERENCES clients(id),
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  channel        text NOT NULL CHECK (channel IN ('EMAIL','SMS')),
  template       text NOT NULL,
  status         text NOT NULL CHECK (status IN ('SENT','FAILED','SUPPRESSED','NOT_CONFIGURED')),
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ─────────────── Settings & audit ───────────────
CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES users(id),
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  metadata    jsonb,          -- never health details
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX audit_created_idx ON audit_log (created_at DESC);

CREATE FUNCTION audit_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_append_only();
