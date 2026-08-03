// Builds the POST /assessments payload from session state.
import type {
  EnergyInputs,
  RoofPolygon,
  SelectedProperty,
} from "../../state/assessmentStore";
import { DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH } from "../../state/assessmentStore";
import { MIN_VALID_ROOF_AREA_SQUARE_METERS } from "../roof/roofUtils";

/**
 * The request body accepted by `POST /assessments`.
 *
 * Decimals travel as strings: the backend parses them with `Decimal`, and a
 * JSON float would round on the way there. The money fields are integers,
 * matching the backend's `StrictInt` — pesos are not quoted anywhere.
 */
export type AssessmentRequest = {
  property: {
    address: string;
    latitude: string;
    longitude: string;
    assessment_date: string;
  };
  roof: {
    area_m2: string;
    usable_area_m2: string;
  };
  inputs: {
    monthly_bill_php: number;
    monthly_consumption_kwh: string;
    electricity_rate_php_per_kwh: string;
    budget_php?: number;
    panel_category_id: string;
  };
};

function formatDecimal(value: number): string {
  return Number(value).toFixed(2);
}

/** Four places is roughly 11 m — finer than the pin the homeowner dropped. */
function formatCoordinate(value: number): string {
  return Number(value).toFixed(4);
}

/**
 * The assessment date as the homeowner's own calendar day.
 *
 * `toISOString` alone reports the UTC day, which is yesterday for the whole
 * Philippine morning — the report would be dated a day behind for anyone who
 * ran it before 8am.
 */
function todayIsoDate(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function buildAssessmentPayload({
  selectedProperty,
  roofPolygon,
  energyInputs,
}: {
  selectedProperty: SelectedProperty | null;
  roofPolygon: RoofPolygon | null;
  energyInputs: EnergyInputs | null;
}): AssessmentRequest {
  // Nothing here has a stand-in. Substituting a demo address or a nominal roof
  // for one nobody gave would return a complete, confident, entirely fictional
  // assessment, which is worse than refusing to build the request at all.
  if (selectedProperty == null) {
    throw new Error("Choose a property before continuing.");
  }

  if (roofPolygon == null) {
    throw new Error("Trace your roof before continuing.");
  }

  const monthlyBillPhp = energyInputs?.monthlyBillPhp ?? null;
  const electricityRatePhpPerKwh =
    energyInputs?.electricityRatePhpPerKwh ??
    DEFAULT_ELECTRICITY_RATE_PHP_PER_KWH;

  if (monthlyBillPhp == null || monthlyBillPhp <= 0) {
    throw new Error("Enter a monthly electricity bill before continuing.");
  }

  if (electricityRatePhpPerKwh <= 0) {
    throw new Error("Electricity rate must be greater than zero.");
  }

  const roofAreaSquareMeters = Math.max(
    roofPolygon.areaSquareMeters,
    MIN_VALID_ROOF_AREA_SQUARE_METERS,
  );

  const monthlyConsumptionKwh = monthlyBillPhp / electricityRatePhpPerKwh;

  const payload: AssessmentRequest = {
    property: {
      address:
        selectedProperty.address ||
        selectedProperty.name ||
        "Selected property",
      latitude: formatCoordinate(selectedProperty.latitude),
      longitude: formatCoordinate(selectedProperty.longitude),
      assessment_date: todayIsoDate(),
    },
    roof: {
      area_m2: formatDecimal(roofAreaSquareMeters),
      usable_area_m2: formatDecimal(roofAreaSquareMeters),
    },
    inputs: {
      monthly_bill_php: Math.round(monthlyBillPhp),
      monthly_consumption_kwh: formatDecimal(monthlyConsumptionKwh),
      electricity_rate_php_per_kwh: formatDecimal(electricityRatePhpPerKwh),
      panel_category_id: "standard-450",
    },
  };

  // Omitted rather than sent as null: a budget nobody entered is not a ceiling
  // of zero, and the backend treats the absent field as "no ceiling".
  const budgetPhp = energyInputs?.budgetPhp;
  if (budgetPhp != null && budgetPhp > 0) {
    payload.inputs.budget_php = Math.round(budgetPhp);
  }

  return payload;
}
