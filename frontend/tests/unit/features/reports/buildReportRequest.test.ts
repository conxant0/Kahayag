import { describe, expect, it } from "vitest";

import { buildReportRequest } from "../../../../src/features/reports/buildReportRequest";
import { MOCK_ASSESSMENT_RESPONSE } from "./mockAssessmentResponse";

const SQUARE_ROOF = {
  coordinates: [
    { latitude: 10.3157, longitude: 123.8854 },
    { latitude: 10.3158, longitude: 123.8854 },
    { latitude: 10.3158, longitude: 123.8855 },
    { latitude: 10.3157, longitude: 123.8855 },
  ],
};

describe("buildReportRequest", () => {
  it("builds one panel polygon per selected panel and echoes the assessment", () => {
    const request = buildReportRequest({
      result: MOCK_ASSESSMENT_RESPONSE,
      roofPolygon: SQUARE_ROOF,
    });

    expect(request.assessment).toBe(MOCK_ASSESSMENT_RESPONSE);
    expect(request.roof_polygon).toEqual(SQUARE_ROOF.coordinates);
    expect(request.panel_polygons).toHaveLength(
      MOCK_ASSESSMENT_RESPONSE.recommendation.panel_count,
    );
    for (const panel of request.panel_polygons) {
      expect(panel.corners).toHaveLength(4);
    }
  });

  it("rejects a roof trace with fewer than three points", () => {
    expect(() =>
      buildReportRequest({
        result: MOCK_ASSESSMENT_RESPONSE,
        roofPolygon: {
          coordinates: [
            { latitude: 10.3157, longitude: 123.8854 },
            { latitude: 10.3158, longitude: 123.8854 },
          ],
        },
      }),
    ).toThrow(
      "Complete the assessment and roof trace before downloading the report.",
    );
  });

  it("rejects when there is no result", () => {
    expect(() =>
      buildReportRequest({ result: null, roofPolygon: SQUARE_ROOF }),
    ).toThrow(
      "Complete the assessment and roof trace before downloading the report.",
    );
  });

  it("rejects when the roof is too small to fit the recommended panel count", () => {
    const tinyRoof = {
      coordinates: [
        { latitude: 10.3157, longitude: 123.8854 },
        { latitude: 10.3157, longitude: 123.885401 },
        { latitude: 10.315701, longitude: 123.885401 },
        { latitude: 10.315701, longitude: 123.8854 },
      ],
    };

    expect(() =>
      buildReportRequest({
        result: MOCK_ASSESSMENT_RESPONSE,
        roofPolygon: tinyRoof,
      }),
    ).toThrow("Could not fit the selected panel count inside the roof trace.");
  });
});
