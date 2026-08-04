// Defines unit tests for the office-run derivation and prerequisite
// checks added for issue #37 — these replace the previously hardcoded,
// now-removed OFFICE_RUN_DOCUMENT_IDS array, so they're the one place that
// would catch a regression in the topological sort or the "unmet
// prerequisite" read.
import { describe, expect, it } from "vitest";

import type { PermitAssessment, PermitDocumentChecklistItem } from "../../../../src/features/permits/permitTypes";
import { officeRunPosition, officeRunStops, unmetPrerequisites, canSubmitPacket } from "../../../../src/features/permits/permitsViewModel";

function doc(overrides: Partial<PermitDocumentChecklistItem>): PermitDocumentChecklistItem {
  return {
    document_id: "doc",
    title: "Doc",
    status: "missing",
    expires: null,
    unverified: false,
    issuing_agency: "Some Office",
    steps: ["Step 1"],
    prerequisites: [],
    ...overrides,
  };
}

function assessmentWith(documents: PermitDocumentChecklistItem[]): PermitAssessment {
  return {
    track: "retrofit",
    net_metering_eligibility: {
      satisfied: true,
      system_kwp: 5,
      cap_kwp: 100,
      legal_basis: "test",
      source_url: "https://example.com",
    },
    permits: [],
    documents,
    findings: [],
    packet_status: "incomplete",
    summary: "",
  };
}

describe("officeRunStops", () => {
  it("orders a document's stop after its prerequisite's stop", () => {
    const assessment = assessmentWith([
      doc({ document_id: "b", title: "B", issuing_agency: "Office B", prerequisites: ["a"] }),
      doc({ document_id: "a", title: "A", issuing_agency: "Office A" }),
    ]);

    const stops = officeRunStops(assessment);
    const officeOrder = stops.map((stop) => stop.office);
    expect(officeOrder.indexOf("Office A")).toBeLessThan(officeOrder.indexOf("Office B"));
  });

  it("groups consecutive same-office documents into one stop", () => {
    const assessment = assessmentWith([
      doc({ document_id: "a", title: "A", issuing_agency: "Same Office" }),
      doc({ document_id: "b", title: "B", issuing_agency: "Same Office" }),
    ]);

    expect(officeRunStops(assessment)).toHaveLength(1);
    expect(officeRunStops(assessment)[0]!.documents).toHaveLength(2);
  });

  it("excludes documents with no fixed office from any stop", () => {
    const assessment = assessmentWith([
      doc({ document_id: "notary-doc", issuing_agency: "Any commissioned notary public" }),
      doc({ document_id: "id-doc", issuing_agency: "N/A — bring an existing ID" }),
      doc({ document_id: "office-doc", issuing_agency: "City Hall" }),
    ]);

    const stops = officeRunStops(assessment);
    expect(stops).toHaveLength(1);
    expect(officeRunPosition("notary-doc", assessment)).toBeNull();
    expect(officeRunPosition("id-doc", assessment)).toBeNull();
    expect(officeRunPosition("office-doc", assessment)).toBe(1);
  });
});

describe("unmetPrerequisites", () => {
  it("names an outstanding prerequisite, with its document id for linking to its row", () => {
    const prereq = doc({ document_id: "a", title: "Document A", status: "missing" });
    const dependent = doc({ document_id: "b", title: "Document B", prerequisites: ["a"] });
    const assessment = assessmentWith([prereq, dependent]);

    expect(unmetPrerequisites(dependent, assessment)).toEqual([
      { documentId: "a", title: "Document A" },
    ]);
  });

  it("is empty once the prerequisite is uploaded", () => {
    const prereq = doc({ document_id: "a", title: "Document A", status: "uploaded" });
    const dependent = doc({ document_id: "b", title: "Document B", prerequisites: ["a"] });
    const assessment = assessmentWith([prereq, dependent]);

    expect(unmetPrerequisites(dependent, assessment)).toEqual([]);
  });

  it("is empty for a document with no prerequisites", () => {
    const solo = doc({ document_id: "solo" });
    const assessment = assessmentWith([solo]);

    expect(unmetPrerequisites(solo, assessment)).toEqual([]);
  });
});

describe("canSubmitPacket", () => {
  it("is false when packet_status is incomplete", () => {
    const assessment = assessmentWith([
      doc({ document_id: "a", status: "missing" }),
    ]);
    expect(canSubmitPacket(assessment)).toBe(false);
  });

  it("is false when packet_status is ready but a blocking finding remains", () => {
    const assessment = {
      ...assessmentWith([doc({ document_id: "a", status: "uploaded" })]),
      packet_status: "ready" as const,
      findings: [
        {
          document_id: "a",
          category: "presence" as const,
          severity: "blocking" as const,
          message: "Still blocked.",
        },
      ],
    };
    expect(canSubmitPacket(assessment)).toBe(false);
  });

  it("is true when packet_status is ready and no blocking findings remain", () => {
    const assessment = {
      ...assessmentWith([doc({ document_id: "a", status: "uploaded" })]),
      packet_status: "ready" as const,
    };
    expect(canSubmitPacket(assessment)).toBe(true);
  });
});
