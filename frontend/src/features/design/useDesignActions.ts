// Defines design session orchestration hooks (bootstrap, goals, agent).
import { useMutation } from "@tanstack/react-query";

import { apiPost } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { DesignSession, MutateDesignPayload, SolverGoal } from "../../shared/api/types";
import { useDesignStore } from "../../state/designStore";

export type AgentDesignPayload = {
  user_text: string;
  dry_run?: boolean;
};

export type AgentDesignResponse = {
  session: DesignSession;
  reply: string;
  requires_confirmation: boolean;
  planned_actions: Array<{ name: string; arguments: Record<string, unknown> }>;
};

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
    mutationFn: (payload: AgentDesignPayload) => {
      if (!designSession) {
        throw new Error("Design session is not ready.");
      }
      return apiPost<AgentDesignResponse>(ENDPOINTS.designsAgent, {
        session: designSession,
        user_text: payload.user_text,
        dry_run: payload.dry_run ?? false,
      });
    },
    onSuccess: (data, variables) => {
      if (!variables.dry_run) {
        setDesignSession(data.session);
      }
    },
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

export function useMutateDesign() {
  const designSession = useDesignStore((state) => state.designSession);
  const setDesignSession = useDesignStore((state) => state.setDesignSession);

  return useMutation({
    mutationFn: (patch: Omit<MutateDesignPayload, "session">) => {
      if (!designSession) {
        throw new Error("Design session is not ready.");
      }
      return apiPost<DesignSession>(ENDPOINTS.designsMutate, {
        session: designSession,
        ...patch,
      });
    },
    onSuccess: (session) => setDesignSession(session),
  });
}
