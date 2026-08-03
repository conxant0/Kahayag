import { useMutation } from "@tanstack/react-query";

import { apiPost } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type {
  InvestmentProjectionRequest,
  InvestmentProjectionResponse,
} from "../../shared/api/types";

export function useInvestmentProjection() {
  return useMutation({
    mutationFn: (request: InvestmentProjectionRequest) =>
      apiPost<InvestmentProjectionResponse>(ENDPOINTS.investmentProjection, request),
  });
}
