// Defines the permits chat mutation, wired to the real POST /permits/chat
// (commit 7ecb4d7) — the one live part of this preview. Follows
// useQuoteAudit.ts's multipart-upload convention: request is a JSON form
// field, slot_ids/files pair positionally (empty here — this chat sends text
// only, no document uploads).
import { useMutation } from "@tanstack/react-query";

import { apiUploadForm } from "../../shared/api/client";
import { ENDPOINTS } from "../../shared/api/endpoints";
import type { PermitChatRequest, PermitChatResponse } from "./permitTypes";

export function usePermitChat() {
  return useMutation({
    mutationFn: async (payload: PermitChatRequest): Promise<PermitChatResponse> => {
      const formData = new FormData();
      formData.append("request", JSON.stringify(payload));
      return apiUploadForm<PermitChatResponse>(ENDPOINTS.permitsChat, formData);
    },
  });
}
