-- Fixes BUG-076, BUG-077, BUG-078, BUG-079 (docs/qa-bug-tracker.md) together
-- -- all four converge on the same root cause: dispensing a prescription
-- (Prescriptions.tsx's confirmDispense()) never touched drug_lots stock,
-- never created a narcotics_log entry for controlled substances, and bound
-- the "pharmacist" to a free-text field a pharmacist typed by hand -- not
-- just in the separate NarcoticsRegister.tsx manual-entry form (as BUG-076
-- was originally scoped), but in the actual dispensing flow itself, which
-- is the higher-impact instance of the same problem.
--
-- BUG-076 (pharmacist_name unverified free text): narcotics_log gains
-- pharmacist_user_id (FK to auth.users), resolved server-side from the
-- authenticated session inside dispense_prescription_item() below -- never
-- trusts a client-supplied name for the compliance-critical path.
-- NarcoticsRegister.tsx's separate manual-entry form (for the rarer case of
-- logging a controlled substance dispensed outside the prescription flow)
-- is fixed the same way in the frontend change accompanying this migration.
--
-- BUG-077 (RLS allows UPDATE/DELETE on a compliance register): replaces the
-- single ALL policy with SELECT + INSERT only -- no UPDATE/DELETE policy
-- exists after this, which RLS-enabled tables deny by default. A
-- legally-mandated append-only log should not be editable or deletable by
-- any tenant role, including the pharmacist who created the entry.
--
-- BUG-078 (narcotics logging disconnected from dispensing) and BUG-079
-- (dispensing never decrements drug_lots): dispense_prescription_item()
-- does both atomically, in the same transaction as the
-- prescription_items.quantity_dispensed update -- FEFO stock decrement
-- (earliest expiry_date first, across as many lots as needed) only when
-- the item is linked to a real drugs catalog entry (drug_id is nullable on
-- prescription_items -- a free-text-only item can't be stock- or
-- classification-checked, so it only gets the dispensed-quantity update,
-- an honest degradation rather than guessing), and auto-inserts a
-- narcotics_log row when the dispensed drug's classification is
-- 'controlled', carrying over already-known patient/doctor/prescription
-- data instead of requiring the pharmacist to separately re-enter it.

ALTER TABLE public.narcotics_log
  ADD COLUMN IF NOT EXISTS pharmacist_user_id uuid REFERENCES auth.users(id);

DROP POLICY IF EXISTS "narcotics_log_tenant_isolation" ON public.narcotics_log;

CREATE POLICY "narcotics_log_select" ON public.narcotics_log
  FOR SELECT
  USING (tenant_id = current_tenant_id());

CREATE POLICY "narcotics_log_insert" ON public.narcotics_log
  FOR INSERT
  WITH CHECK (tenant_id = current_tenant_id());

CREATE OR REPLACE FUNCTION public.dispense_prescription_item(p_prescription_item_id uuid, p_quantity integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id           uuid;
  v_prescription_id     uuid;
  v_drug_id             uuid;
  v_quantity_prescribed integer;
  v_quantity_dispensed  integer;
  v_drug_name           text;
  v_classification      text;
  v_remaining_to_take   integer;
  v_lot                 RECORD;
  v_take                integer;
  v_lot_numbers         text[] := '{}';
  v_patient_name        text;
  v_patient_id_number   text;
  v_doctor_name         text;
  v_doctor_license      text;
  v_pharmacist_id       uuid := auth.uid();
  v_pharmacist_name     text;
BEGIN
  SELECT pi.prescription_id, pi.drug_id, pi.quantity_prescribed, pi.quantity_dispensed, pi.drug_name,
         p.tenant_id, p.patient_name, p.patient_id_number, p.doctor_name, p.doctor_license
    INTO v_prescription_id, v_drug_id, v_quantity_prescribed, v_quantity_dispensed, v_drug_name,
         v_tenant_id, v_patient_name, v_patient_id_number, v_doctor_name, v_doctor_license
    FROM prescription_items pi
    JOIN prescriptions p ON p.id = pi.prescription_id
    WHERE pi.id = p_prescription_item_id
    FOR UPDATE OF pi;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'prescription_item_not_found: %', p_prescription_item_id;
  END IF;

  IF v_tenant_id IS DISTINCT FROM current_tenant_id() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity: %', p_quantity;
  END IF;

  IF v_quantity_dispensed + p_quantity > v_quantity_prescribed THEN
    RAISE EXCEPTION 'exceeds_prescribed_quantity: dispensed % + % > prescribed %', v_quantity_dispensed, p_quantity, v_quantity_prescribed;
  END IF;

  SELECT name INTO v_pharmacist_name FROM employees WHERE user_id = v_pharmacist_id AND tenant_id = v_tenant_id LIMIT 1;
  v_pharmacist_name := COALESCE(v_pharmacist_name, 'Unknown');

  IF v_drug_id IS NOT NULL THEN
    SELECT classification INTO v_classification FROM drugs WHERE id = v_drug_id;

    v_remaining_to_take := p_quantity;
    FOR v_lot IN
      SELECT id, lot_number, quantity_remaining
      FROM drug_lots
      WHERE drug_id = v_drug_id AND tenant_id = v_tenant_id AND quantity_remaining > 0
      ORDER BY expiry_date ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_to_take <= 0;
      v_take := LEAST(v_lot.quantity_remaining, v_remaining_to_take);
      UPDATE drug_lots SET quantity_remaining = quantity_remaining - v_take WHERE id = v_lot.id;
      v_remaining_to_take := v_remaining_to_take - v_take;
      v_lot_numbers := array_append(v_lot_numbers, v_lot.lot_number);
    END LOOP;

    IF v_remaining_to_take > 0 THEN
      RAISE EXCEPTION 'insufficient_stock: % units short for drug %', v_remaining_to_take, v_drug_id;
    END IF;
  END IF;

  UPDATE prescription_items
    SET quantity_dispensed = v_quantity_dispensed + p_quantity,
        dispensed_at = now(),
        dispensing_pharmacist = v_pharmacist_name
    WHERE id = p_prescription_item_id;

  IF v_classification = 'controlled' THEN
    INSERT INTO narcotics_log (
      tenant_id, drug_id, drug_name, lot_number, quantity, patient_name,
      patient_id_number, doctor_name, doctor_license, pharmacist_name,
      pharmacist_user_id, prescription_id, dispensed_at
    ) VALUES (
      v_tenant_id, v_drug_id, v_drug_name,
      NULLIF(array_to_string(v_lot_numbers, ', '), ''),
      p_quantity, v_patient_name, COALESCE(v_patient_id_number, 'not on file'),
      v_doctor_name, COALESCE(v_doctor_license, 'not on file'),
      v_pharmacist_name, v_pharmacist_id, v_prescription_id, now()
    );
  END IF;

  RETURN jsonb_build_object('classification', v_classification, 'lots_used', v_lot_numbers);
END;
$function$;
