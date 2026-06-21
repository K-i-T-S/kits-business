export type DrugClassification = 'otc' | 'prescription_required' | 'controlled';
export type PrescriptionStatus = 'pending' | 'partially_filled' | 'filled' | 'cancelled';
export type InsuranceProvider = 'cnss' | 'allianz' | 'axa' | 'medgulf' | 'aramco' | 'un' | 'bdl' | 'other';
export type ClaimStatus = 'pending' | 'submitted' | 'approved' | 'rejected';

export interface Drug {
  id: string;
  tenant_id: string;
  trade_name: string;
  generic_name: string;
  atc_code: string | null;
  manufacturer: string | null;
  classification: DrugClassification;
  form: string | null;
  strength: string | null;
  vat_rate: number;
  barcode: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DrugLot {
  id: string;
  tenant_id: string;
  drug_id: string;
  lot_number: string;
  expiry_date: string;
  quantity_received: number;
  quantity_remaining: number;
  unit_cost: number;
  received_at: string;
  created_at: string;
}

export interface Prescription {
  id: string;
  tenant_id: string;
  patient_name: string;
  patient_phone: string | null;
  patient_id_number: string | null;
  doctor_name: string;
  doctor_license: string | null;
  issue_date: string;
  status: PrescriptionStatus;
  notes: string | null;
  image_url: string | null;
  created_at: string;
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  drug_id: string | null;
  drug_name: string;
  quantity_prescribed: number;
  quantity_dispensed: number;
  dispensed_at: string | null;
  dispensing_pharmacist: string | null;
}

export interface NarcoticsLogEntry {
  id: string;
  tenant_id: string;
  drug_id: string;
  drug_name: string;
  lot_number: string;
  quantity: number;
  patient_name: string;
  patient_id_number: string;
  doctor_name: string;
  doctor_license: string;
  pharmacist_name: string;
  prescription_id: string | null;
  dispensed_at: string;
  notes: string | null;
  created_at: string;
}

export interface InsuranceClaim {
  id: string;
  tenant_id: string;
  patient_name: string;
  policy_number: string | null;
  provider: InsuranceProvider;
  total_amount: number;
  copay_percentage: number;
  copay_amount: number;
  insurance_amount: number;
  currency: 'USD' | 'LBP';
  claim_date: string;
  status: ClaimStatus;
  notes: string | null;
  created_at: string;
}

export const DRUG_CLASSIFICATION_LABELS: Record<DrugClassification, string> = {
  otc: 'OTC',
  prescription_required: 'Prescription Required',
  controlled: 'Controlled Substance',
};

export const DRUG_CLASSIFICATION_COLORS: Record<DrugClassification, { bg: string; text: string; border: string }> = {
  otc: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  prescription_required: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/40' },
  controlled: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/40' },
};

export const PRESCRIPTION_STATUS_COLORS: Record<PrescriptionStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  partially_filled: { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  filled: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  cancelled: { bg: 'bg-slate-500/15', text: 'text-slate-400' },
};

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  pending: 'Pending',
  partially_filled: 'Partially Filled',
  filled: 'Filled',
  cancelled: 'Cancelled',
};

export const INSURANCE_PROVIDERS: { key: InsuranceProvider; label: string; defaultCopay: number }[] = [
  { key: 'cnss', label: 'CNSS', defaultCopay: 20 },
  { key: 'allianz', label: 'Allianz', defaultCopay: 20 },
  { key: 'axa', label: 'AXA', defaultCopay: 20 },
  { key: 'medgulf', label: 'Medgulf', defaultCopay: 15 },
  { key: 'aramco', label: 'Aramco', defaultCopay: 10 },
  { key: 'un', label: 'UN / UNRWA', defaultCopay: 0 },
  { key: 'bdl', label: 'BDL Staff', defaultCopay: 10 },
  { key: 'other', label: 'Other', defaultCopay: 20 },
];

export const CLAIM_STATUS_COLORS: Record<ClaimStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  submitted: { bg: 'bg-sky-500/15', text: 'text-sky-400' },
  approved: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  rejected: { bg: 'bg-red-500/15', text: 'text-red-400' },
};
