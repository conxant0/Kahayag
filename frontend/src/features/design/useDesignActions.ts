// Defines design session orchestration hooks (bootstrap, goals, agent).
import { useMutation } from "@tanstack/react-query";

import { apiPost } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { DesignSession, SolverGoal } from "../../shared/api/types";
import { useDesignStore } from "../../state/designStore";

export function useBootstrapDesign() {
  const setDesignSession = useDesignStore((state) => state.setDesignSession);

  return useMutation({
    mutationFn: (payload: { assessment: Record<string, unknown>; property_ref: string }) =>
      apiPost<DesignSession>(ENDPOINTS.designsBootstrap, payload),
    onSuccess: (session) => setDesignSession(session),
  });
}

export function useOptimiseDesign() {
  const designSession = useDesignStore((state) => state.designSession);
  const setDesignSession = useDesignStore((state) => state.setDesignSession);

  return useMutation({
    mutationFn: (goal: SolverGoal) => {
      if (!designSession) {
        throw new Error("Design session is not ready.");
      }
      return apiPost<DesignSession>(ENDPOINTS.designsOptimise, {
        session: designSession,
        goal,
      });
    },
    onSuccess: (session) => setDesignSession(session),
  });
}

export function useDesignAgent() {
  const designSession = useDesignStore((state) => state.designSession);
  const setDesignSession = useDesignStore((state) => state.setDesignSession);

  return useMutation({
    mutationFn: (user_text: string) => {
      if (!designSession) {
        throw new Error("Design session is not ready.");
      }
      return apiPost<{ session: DesignSession; reply: string }>(
        ENDPOINTS.designsAgent,
        { session: designSession, user_text },
      );
    },
    onSuccess: ({ session }) => setDesignSession(session),
  });
}

export function useExplainDesign() {
  const designSession = useDesignStore((state) => state.designSession);

  return useMutation({
    mutationFn: (question: string) => {
      if (!designSession) {
        throw new Error("Design session is not ready.");
      }
      return apiPost<{ explanation: string }>(ENDPOINTS.designsExplain, {
        session: designSession,
        question,
      });
    },
  });
}
