-- AI TAX production SaaS foundation. Run after 001-004.
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK(role IN('OWNER','ADMIN','ACCOUNTANT','REVIEWER','VIEWER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,organization_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS government_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NOT_CONNECTED' CHECK(status IN('NOT_CONNECTED','PENDING_CONSENT','CONNECTED','EXPIRED','ERROR')),
  external_subject TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,provider,connection_type)
);
CREATE TABLE IF NOT EXISTS automation_policies (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK(level BETWEEN 0 AND 4),
  auto_post_low_risk BOOLEAN NOT NULL DEFAULT false,
  auto_reconcile BOOLEAN NOT NULL DEFAULT true,
  auto_prepare_returns BOOLEAN NOT NULL DEFAULT true,
  filing_requires_authorization BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  decision JSONB NOT NULL,
  confidence NUMERIC(6,5),
  requires_review BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK(status IN('PROPOSED','APPROVED','REJECTED','APPLIED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS realtime_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS idempotency_keys (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,key)
);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_org_time ON ai_decisions(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_events_org_id ON realtime_events(organization_id,id DESC);

CREATE OR REPLACE FUNCTION ai_tax_emit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('ai_tax_events', json_build_object('organization_id',NEW.organization_id,'event_id',NEW.id,'event_type',NEW.event_type)::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS realtime_event_notify ON realtime_events;
CREATE TRIGGER realtime_event_notify AFTER INSERT ON realtime_events FOR EACH ROW EXECUTE FUNCTION ai_tax_emit_event();

-- Seed a local development automation policy for the existing demo tenant.
INSERT INTO automation_policies(organization_id) SELECT id FROM organizations WHERE id='00000000-0000-0000-0000-000000000001' ON CONFLICT DO NOTHING;
