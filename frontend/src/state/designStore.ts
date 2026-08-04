// Defines design session state for post-results D3 flow.
import { create } from "zustand";

import type { DesignSession, QuoteAuditResponse } from "../shared/api/types";

export type DesignState = {
  designSession: DesignSession | null;
  quoteAuditResults: QuoteAuditResponse[];
  activeQuoteFilename: string | null;
  setDesignSession: (session: DesignSession | null) => void;
  addQuoteAuditResult: (result: QuoteAuditResponse) => void;
  removeQuoteAuditResult: (filename: string) => void;
  clearQuoteAuditResults: () => void;
  applyDesign: () => void;
  selectBuild: (buildId: string) => void;
  selectQuoteAudit: (filename: string) => void;
  clearDesign: () => void;
};

export const useDesignStore = create<DesignState>()((set, get) => ({
  designSession: null,
  quoteAuditResults: [],
  activeQuoteFilename: null,

  setDesignSession: (designSession) => set({ designSession }),

  addQuoteAuditResult: (result) =>
    set((state) => ({
      quoteAuditResults: [
        ...state.quoteAuditResults.filter(
          (existing) => existing.filename !== result.filename,
        ),
        result,
      ],
    })),

  removeQuoteAuditResult: (filename) =>
    set((state) => ({
      quoteAuditResults: state.quoteAuditResults.filter(
        (result) => result.filename !== filename,
      ),
    })),

  clearQuoteAuditResults: () => set({ quoteAuditResults: [] }),

  applyDesign: () => {
    const session = get().designSession;
    if (!session) {
      return;
    }
    set({ designSession: { ...session, applied: true } });
  },

  selectBuild: (buildId) => {
    const session = get().designSession;
    if (!session) {
      return;
    }
    const exists = session.builds.some((build) => build.id === buildId);
    if (!exists) {
      return;
    }
    set({
      designSession: { ...session, active_build_id: buildId },
      activeQuoteFilename: null,
    });
  },

  selectQuoteAudit: (filename) => {
    const exists = get().quoteAuditResults.some(
      (result) => result.filename === filename,
    );
    if (!exists) {
      return;
    }
    set({ activeQuoteFilename: filename });
  },

  clearDesign: () =>
    set({ designSession: null, quoteAuditResults: [], activeQuoteFilename: null }),
}));
