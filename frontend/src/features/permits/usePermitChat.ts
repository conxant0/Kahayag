// Defines the permits chat mutation, wired to the real POST /permits/chat
// (commit 7ecb4d7) — the one live part of this preview. Follows
// useAssessPermit.ts's multipart-upload convention: request is a JSON form
// field, slot_ids/files pair positionally with every document uploaded so
// far, so the backend grounds its reply in the same packet the checklist
// shows instead of recomputing from zero uploads.
import { useMutation } from "@tanstack/react-query";

import { apiUploadForm } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { PermitChatRequest, PermitChatResponse } from "./permitTypes";

export interface PermitChatInput {
  payload: PermitChatRequest;
  uploads: ReadonlyMap<string, File>;
}

export function usePermitChat() {
  return useMutation({
    mutationFn: async ({ payload, uploads }: PermitChatInput): Promise<PermitChatResponse> => {
      const formData = new FormData();
      formData.append("request", JSON.stringify(payload));
      for (const [documentId, file] of uploads) {
        formData.append("slot_ids", documentId);
        formData.append("files", file);
      }
      return apiUploadForm<PermitChatResponse>(ENDPOINTS.permitsChat, formData);
    },
  });
}
