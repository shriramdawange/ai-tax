-- AI TAX Part 3: GST + TDS compliance domain
-- Versioned rules are data, not LLM prompts. Production rule packs must be reviewed before activation.
CREATE TABLE IF NOT EXISTS gst_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code TEXT NOT NULL,
  title TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN('RATE','CLASSIFICATION','ITC','RETURN')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','ACTIVE','RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(rule_code,effective_from)
);
CREATE TABLE IF NOT EXISTS gst_2b_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  supplier_gstin TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  filing_period TEXT,
  taxable_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  cgst NUMERIC(18,2) NOT NULL DEFAULT 0,
  sgst NUMERIC(18,2) NOT NULL DEFAULT 0,
  igst NUMERIC(18,2) NOT NULL DEFAULT 0,
  cess NUMERIC(18,2) NOT NULL DEFAULT 0,
  source_hash TEXT NOT NULL,
  source_status TEXT NOT NULL DEFAULT 'IMPORTED' CHECK(source_status IN('IMPORTED','FILED_DATA','REVISED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,source_hash)
);
CREATE TABLE IF NOT EXISTS gst_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  gst_transaction_id UUID REFERENCES gst_transactions(id),
  gst_2b_record_id UUID REFERENCES gst_2b_records(id),
  match_status TEXT NOT NULL CHECK(match_status IN('MATCHED','VALUE_MISMATCH','MISSING_IN_2B','MISSING_IN_BOOKS','DUPLICATE','REVIEW')),
  confidence NUMERIC(6,3) NOT NULL DEFAULT 0,
  difference JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gst2b_org_supplier_invoice ON gst_2b_records(organization_id,supplier_gstin,invoice_number);
CREATE INDEX IF NOT EXISTS idx_gst_recon_org_status ON gst_reconciliations(organization_id,match_status);

CREATE TABLE IF NOT EXISTS tds_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_code TEXT NOT NULL,
  title TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  threshold_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  rate NUMERIC(8,4) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','ACTIVE','RETIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE(section_code,effective_from)
);
CREATE TABLE IF NOT EXISTS tds_return_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  section_code TEXT,
  party_id UUID REFERENCES parties(id),
  gross_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  tds_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PREPARED' CHECK(status IN('PREPARED','VALIDATED','FILED','REJECTED')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tds_return_org_period ON tds_return_records(organization_id,period_start,period_end);

CREATE TABLE IF NOT EXISTS tax_return_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  return_type TEXT NOT NULL CHECK(return_type IN('GSTR1','GSTR3B','TDS')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN('DRAFT','VALIDATED','READY','SUBMITTED','ACCEPTED','REJECTED')),
  payload JSONB NOT NULL,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id,return_type,period_start,period_end,version)
);
CREATE INDEX IF NOT EXISTS idx_tax_snapshots_org_type_period ON tax_return_snapshots(organization_id,return_type,period_start,period_end);
