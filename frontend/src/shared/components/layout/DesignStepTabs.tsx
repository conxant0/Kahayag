// Defines the in-step navigation between design workspace and compare views.
import { NavLink } from "react-router-dom";

import { ROUTE_PATHS } from "../../../app/routePaths";
import { cn } from "../../lib/cn";

const TABS = [
  { label: "Design workspace", path: ROUTE_PATHS.design },
  { label: "Compare builds", path: ROUTE_PATHS.compare },
] as const;

export function DesignStepTabs({ className }: { className?: string }) {
  return (
    <nav
      aria-label="AI design views"
      className={cn("flex justify-start", className)}
    >
      <div className="inline-flex gap-1 rounded-[14px] border border-hairline bg-white p-1 shadow-[0_2px_8px_rgba(26,23,18,0.04)]">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              cn(
                "rounded-[10px] px-4 py-2 font-sans text-[13px] font-semibold transition-colors duration-150 ease-brand",
                isActive
                  ? "bg-ink text-paper"
                  : "text-secondary hover:bg-[#f7f4ed] hover:text-ink",
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
