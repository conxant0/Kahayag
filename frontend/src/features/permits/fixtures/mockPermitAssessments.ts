// Defines mock permit assessments for UI-first development of the permits
// preview, driven by a fixture rather than the live endpoint (T3a). Follows
// the fixture pattern in `frontend/src/features/design/fixtures/mockDesignSession.ts`.
//
// Two scenarios, chosen to cover the interesting states rather than only the
// happy path:
//  - `mockPermitAssessmentIncomplete`: retrofit track, applicant is not the
//    registered owner (adds the notarized-authorization row), a missing
//    document, a name mismatch, an unreadable scan, and an unverified
//    catalog row.
//  - `mockPermitAssessmentComplete`: streamlined track, applicant is the
//    owner, everything uploaded and consistent, packet ready.
import type { PermitAssessment } from "../permitTypes";

export const mockPermitAssessmentIncomplete: PermitAssessment = {
  track: "retrofit",
  net_metering_eligibility: {
    satisfied: true,
    system_kwp: 5.85,
    cap_kwp: 100,
    legal_basis: "ERC Resolution No. 09, Series of 2017, Rule 3",
    source_url: "https://erc.gov.ph/",
  },
  permits: [
    {
      id: "obo_building_permit",
      name: "OBO Building Permit (retrofit, solar addition)",
      issuing_agency: "Cebu City Office of the Building Official",
      unverified: false,
      unverified_notes: [],
    },
    {
      id: "electrical_permit",
      name: "Electrical Permit",
      issuing_agency: "Cebu City Office of the Building Official",
      unverified: false,
      unverified_notes: [],
    },
    {
      id: "net_metering_agreement",
      name: "Net Metering Agreement",
      issuing_agency: "Visayan Electric Company (VECO)",
      unverified: true,
      unverified_notes: [
        "VECO's current net metering application form has not been independently confirmed against this list.",
      ],
    },
  ],
  documents: [
    {
      document_id: "tct",
      title: "Transfer Certificate of Title (TCT)",
      status: "uploaded",
      expires: false,
      unverified: false,
      issuing_agency: "Registry of Deeds, Cebu City",
      steps: [
        "Request a certified true copy online through the LRA eSerbisyo portal (eserbisyo.lra.gov.ph) — delivered to you, no office visit needed.",
        "Have the registered owner's name, title (TCT) number, and lot number on hand.",
        "Allow 5–7 working days for a provincial request like Cebu — and up to two weeks if the title needs manual validation.",
      ],
      prerequisites: [],
    },
    {
      document_id: "tax_declaration",
      title: "Tax Declaration",
      status: "missing",
      expires: false,
      unverified: false,
      issuing_agency: "City Assessor's Office, Cebu City",
      steps: [
        "Go to the City Assessor's Office at Cebu City Hall and request a certified true copy of the lot's tax declaration.",
        "Have the owner's name, tax declaration number, and lot number on hand — the copy must carry them exactly as registered.",
      ],
      prerequisites: [],
    },
    {
      document_id: "tax_clearance",
      title: "Real Property Tax Clearance",
      status: "needs_review",
      expires: true,
      unverified: false,
      issuing_agency: "City Treasurer's Office, Cebu City",
      steps: [
        "Go to the City Treasurer's Office at Cebu City Hall and request a real property tax clearance for the lot.",
        "Real property tax must be paid up for the current year — the clearance reflects that payment status.",
        "Your cedula comes from the same office, so one visit can cover both.",
      ],
      prerequisites: ["tax_declaration"],
    },
    {
      document_id: "barangay_clearance",
      title: "Barangay Clearance",
      status: "uploaded",
      expires: true,
      unverified: false,
      issuing_agency: "Barangay Hall (property's barangay)",
      steps: [
        "Go to the barangay hall of the barangay that covers the property and request a barangay clearance for construction.",
        "Address and office hours vary per barangay — check with yours before heading out.",
      ],
      prerequisites: [],
    },
    {
      document_id: "cedula",
      title: "Community Tax Certificate (Cedula)",
      status: "uploaded",
      expires: true,
      unverified: true,
      issuing_agency: "City Treasurer's Office, Cebu City",
      steps: [
        "Request a Community Tax Certificate (cedula) at the City Treasurer's Office, Cebu City Hall — the same office that issues the tax clearance, so one visit covers both.",
        "Check the date before leaving the counter: it must be issued for the current year.",
      ],
      prerequisites: [],
    },
    {
      document_id: "notarized_authorization",
      title: "Notarized Consent and Authority to file",
      status: "missing",
      expires: false,
      unverified: false,
      issuing_agency: "Any commissioned notary public",
      steps: [
        "Have the registered owner write and sign a Consent and Authority naming who is authorized to file for this property.",
        "Bring it to any commissioned notary public for notarization — this can happen at any point, in any order.",
      ],
      prerequisites: [],
    },
  ],
  findings: [
    {
      document_id: "tax_declaration",
      category: "presence",
      severity: "blocking",
      message: "This slot requires Tax Declaration. No file has been uploaded. Upload Tax Declaration to continue.",
    },
    {
      document_id: "tax_clearance",
      category: "unreadable",
      severity: "warning",
      message:
        "The uploaded tax clearance scan is too low-resolution to extract the property owner's name or expiry date. Re-scan at a higher resolution or take a clearer photo.",
    },
    {
      document_id: "barangay_clearance",
      category: "name_mismatch",
      severity: "blocking",
      message:
        'The name on this barangay clearance reads "Maria C. Santos", but you entered "Maria Cruz Santos-Reyes" as your full name. Confirm this is the same person, or re-upload the correct document.',
    },
    {
      document_id: "notarized_authorization",
      category: "presence",
      severity: "blocking",
      message:
        "This slot requires a notarized authorization from the registered owner. No file has been uploaded. Upload a notarized authorization from the registered owner to continue.",
    },
    {
      document_id: "cedula",
      category: "expiry",
      severity: "info",
      message:
        "Cedulas are issued yearly. Confirm this one is dated for the current year before handing off the packet.",
    },
  ],
  packet_status: "incomplete",
  summary:
    "Your retrofit packet needs attention: the tax declaration is missing, the tax clearance scan couldn't be read, and the name on your barangay clearance doesn't match what you entered. Because you're not the registered owner, a notarized authorization is also required and hasn't been uploaded. Resolve these before handing the packet to your installer.",
};

export const mockPermitAssessmentComplete: PermitAssessment = {
  track: "streamlined",
  net_metering_eligibility: {
    satisfied: true,
    system_kwp: 5.85,
    cap_kwp: 100,
    legal_basis:
      "Joint Memorandum Circular (JMC) 001-2026, Streamlined Rooftop Solar Track",
    source_url: "https://erc.gov.ph/",
  },
  permits: [
    {
      id: "streamlined_solar_notice",
      name: "Streamlined Rooftop Solar Notice (JMC 001-2026)",
      issuing_agency: "Cebu City Office of the Building Official",
      unverified: false,
      unverified_notes: [],
    },
    {
      id: "net_metering_agreement",
      name: "Net Metering Agreement",
      issuing_agency: "Visayan Electric Company (VECO)",
      unverified: true,
      unverified_notes: [
        "VECO's current net metering application form has not been independently confirmed against this list.",
      ],
    },
  ],
  documents: [
    {
      document_id: "tct",
      title: "Transfer Certificate of Title (TCT)",
      status: "uploaded",
      expires: false,
      unverified: false,
      issuing_agency: "Registry of Deeds, Cebu City",
      steps: [
        "Request a certified true copy online through the LRA eSerbisyo portal (eserbisyo.lra.gov.ph) — delivered to you, no office visit needed.",
        "Have the registered owner's name, title (TCT) number, and lot number on hand.",
      ],
      prerequisites: [],
    },
    {
      document_id: "tax_declaration",
      title: "Tax Declaration",
      status: "uploaded",
      expires: false,
      unverified: false,
      issuing_agency: "City Assessor's Office, Cebu City",
      steps: [
        "Go to the City Assessor's Office at Cebu City Hall and request a certified true copy of the lot's tax declaration.",
        "Have the owner's name, tax declaration number, and lot number on hand — the copy must carry them exactly as registered.",
      ],
      prerequisites: [],
    },
    {
      document_id: "barangay_clearance",
      title: "Barangay Clearance",
      status: "uploaded",
      expires: true,
      unverified: false,
      issuing_agency: "Barangay Hall (property's barangay)",
      steps: [
        "Go to the barangay hall of the barangay that covers the property and request a barangay clearance for construction.",
        "Address and office hours vary per barangay — check with yours before heading out.",
      ],
      prerequisites: [],
    },
  ],
  findings: [
    {
      document_id: "tct",
      category: "presence",
      severity: "info",
      message: "Owner name on the TCT matches the name you entered.",
    },
  ],
  packet_status: "ready",
  summary:
    "All three streamlined-track documents are uploaded, readable, and consistent with the name you entered. Your side of the paperwork is ready to hand off to your installer.",
};

export const PERMIT_ASSESSMENT_SCENARIOS = {
  incomplete: mockPermitAssessmentIncomplete,
  complete: mockPermitAssessmentComplete,
} as const;

export type PermitAssessmentScenario = keyof typeof PERMIT_ASSESSMENT_SCENARIOS;

export const MOCK_PROPERTY_ADDRESS =
  "Blk 4 Lot 12, Mabolo, Cebu City, Cebu, Philippines";
