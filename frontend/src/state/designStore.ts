// Defines design session state for post-results D3 flow.
import { create } from "zustand";

import type { DesignSession } from "../shared/api/types";

export type DesignState = {
  designSession: DesignSession | null;
  setDesignSession: (session: DesignSession | null) => void;
  applyDesign: () => void;
  selectBuild: (buildId: string) => void;
  clearDesign: () => void;
};

export const useDesignStore = create<DesignState>()((set, get) => ({
  designSession: null,

  setDesignSession: (designSession) => set({ designSession }),

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
    set({ designSession: { ...session, active_build_id: buildId } });
  },

  clearDesign: () => set({ designSession: null }),
}));
