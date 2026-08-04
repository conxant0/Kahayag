// Defines TypeScript shapes mirroring the permits API contract
// (backend/app/features/permits/schemas.py). Field names and literal unions
// match exactly so T3b's live wiring is a data swap, not a rebuild.

export type SolarInOriginalPermitAnswer = "yes" | "no" | "not_sure";
export type PermitTrack = "streamlined" | "retrofit";
export type DocumentSlotStatus = "missing" | "uploaded" | "needs_review";
export type FindingCategory =
  | "presence"
  | "wrong_slot"
  | "unreadable"
  | "address_mismatch"
  | "name_mismatch"
  | "expiry";
export type FindingSeverity = "info" | "warning" | "blocking";
export type PacketStatus = "ready" | "incomplete";

export interface ApplicantAnswers {
  solar_in_original_permit: SolarInOriginalPermitAnswer;
  full_name: string;
  is_registered_owner: boolean;
  registered_owner_name: string | null;
}

export interface PermitFinding {
  document_id: string | null;
  category: FindingCategory;
  severity: FindingSeverity;
  message: string;
}

export interface PermitDocumentChecklistItem {
  document_id: string;
  title: string;
  status: DocumentSlotStatus;
  expires: boolean | null;
  unverified: boolean;
}

export interface PermitRequirement {
  id: string;
  name: string;
  issuing_agency: string;
  unverified: boolean;
  unverified_notes: readonly string[];
}

export interface NetMeteringEligibility {
  satisfied: boolean;
  system_kwp: number;
  cap_kwp: number;
  legal_basis: string;
  source_url: string;
}

export interface PermitAssessment {
  track: PermitTrack;
  net_metering_eligibility: NetMeteringEligibility;
  permits: readonly PermitRequirement[];
  documents: readonly PermitDocumentChecklistItem[];
  findings: readonly PermitFinding[];
  packet_status: PacketStatus;
  summary: string;
}
