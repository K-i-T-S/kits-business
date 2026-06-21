-- Sprint 2.3: Pharmacy Vertical Schema
-- Drug database, lots, prescriptions, narcotics register, insurance claims
-- All tables tenant-scoped with RLS

-- ── Drug Database ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trade_name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  atc_code TEXT,
  manufacturer TEXT,
  classification TEXT NOT NULL DEFAULT 'otc'
    CHECK (classification IN ('otc', 'prescription_required', 'controlled')),
  form TEXT,         -- tablet, capsule, syrup, injection, etc.
  strength TEXT,     -- 500mg, 10mg/ml, etc.
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0, -- 0 for medications, 11 for parapharmacy
  barcode TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drugs_tenant ON drugs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drugs_trade_name ON drugs(tenant_id, trade_name);
CREATE INDEX IF NOT EXISTS idx_drugs_generic ON drugs(tenant_id, generic_name);
CREATE INDEX IF NOT EXISTS idx_drugs_classification ON drugs(tenant_id, classification);

ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drugs_tenant_isolation" ON drugs
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Drug Lots (FEFO tracking) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS drug_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  quantity_remaining INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT drug_lots_qty_check CHECK (quantity_remaining >= 0)
);

CREATE INDEX IF NOT EXISTS idx_drug_lots_tenant ON drug_lots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drug_lots_drug ON drug_lots(drug_id);
CREATE INDEX IF NOT EXISTS idx_drug_lots_expiry ON drug_lots(expiry_date);

ALTER TABLE drug_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drug_lots_tenant_isolation" ON drug_lots
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Prescriptions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_phone TEXT,
  patient_id_number TEXT,  -- national ID / social security
  doctor_name TEXT NOT NULL,
  doctor_license TEXT,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partially_filled', 'filled', 'cancelled')),
  notes TEXT,
  image_url TEXT,  -- photo of prescription
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant ON prescriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(tenant_id, patient_name);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(tenant_id, status);

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prescriptions_tenant_isolation" ON prescriptions
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Prescription Items ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_id UUID REFERENCES drugs(id),
  drug_name TEXT NOT NULL,
  quantity_prescribed INTEGER NOT NULL DEFAULT 1,
  quantity_dispensed INTEGER NOT NULL DEFAULT 0,
  dispensed_at TIMESTAMPTZ,
  dispensing_pharmacist TEXT,
  CONSTRAINT prescription_items_qty CHECK (quantity_dispensed <= quantity_prescribed)
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);

ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;

-- Inherit access via prescription's tenant_id
CREATE POLICY "prescription_items_tenant_isolation" ON prescription_items
  USING (
    prescription_id IN (
      SELECT id FROM prescriptions WHERE tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    prescription_id IN (
      SELECT id FROM prescriptions WHERE tenant_id = current_tenant_id()
    )
  );

-- ── Narcotics Register (Law 673/1998 compliance) ───────────────────
CREATE TABLE IF NOT EXISTS narcotics_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  drug_id UUID REFERENCES drugs(id),
  drug_name TEXT NOT NULL,
  lot_number TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  patient_name TEXT NOT NULL,
  patient_id_number TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  doctor_license TEXT NOT NULL,
  pharmacist_name TEXT NOT NULL,
  prescription_id UUID REFERENCES prescriptions(id),
  dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_narcotics_log_tenant ON narcotics_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_narcotics_log_dispensed ON narcotics_log(tenant_id, dispensed_at);
CREATE INDEX IF NOT EXISTS idx_narcotics_log_drug ON narcotics_log(drug_id);

ALTER TABLE narcotics_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "narcotics_log_tenant_isolation" ON narcotics_log
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Insurance Claims ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pharmacy_insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  policy_number TEXT,
  provider TEXT NOT NULL
    CHECK (provider IN ('cnss', 'allianz', 'axa', 'medgulf', 'aramco', 'un', 'bdl', 'other')),
  total_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  copay_percentage NUMERIC(5,2) NOT NULL DEFAULT 20,
  copay_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  insurance_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'LBP')),
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pharmacy_claims_tenant ON pharmacy_insurance_claims(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_claims_provider ON pharmacy_insurance_claims(tenant_id, provider);
CREATE INDEX IF NOT EXISTS idx_pharmacy_claims_date ON pharmacy_insurance_claims(tenant_id, claim_date);

ALTER TABLE pharmacy_insurance_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pharmacy_claims_tenant_isolation" ON pharmacy_insurance_claims
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
