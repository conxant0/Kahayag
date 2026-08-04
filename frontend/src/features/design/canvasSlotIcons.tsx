// Defines slot icons and accent colors for the design system canvas.
import type { ComponentSlot } from "../../shared/api/types";
import { cn } from "../../shared/lib/cn";

export const SLOT_ACCENT: Record<
  ComponentSlot,
  { bg: string; icon: string; label: string }
> = {
  panel: { bg: "bg-[#fff6dd]", icon: "text-[#9a7200]", label: "PV equipment" },
  inverter: { bg: "bg-[#fff4cc]", icon: "text-[#7a5c00]", label: "Power hub" },
  battery: { bg: "bg-[#edf3ff]", icon: "text-cobalt", label: "Energy store" },
  protection: { bg: "bg-[#f2eee4]", icon: "text-secondary", label: "Protection layer" },
  structure: { bg: "bg-[#f2eee4]", icon: "text-secondary", label: "Structure" },
  electrical: { bg: "bg-[#f2eee4]", icon: "text-secondary", label: "Electrical" },
  installation: { bg: "bg-[#f2eee4]", icon: "text-secondary", label: "Installation" },
};

export function CanvasSlotIcon({
  slot,
  className,
  size = 22,
}: {
  slot: ComponentSlot;
  className?: string;
  size?: number;
}) {
  const accent = SLOT_ACCENT[slot]?.icon ?? "text-cobalt";

  if (slot === "panel") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn(accent, className)}>
        <rect x="2" y="5" width="20" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2 11h20M8 5v14M16 5v14" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }

  if (slot === "inverter") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn(accent, className)}>
        <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 10h8M7 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M16 10v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (slot === "battery") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn(accent, className)}>
        <rect x="3" y="8" width="16" height="9" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M19 10.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M7 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn(accent, className)}>
      <path d="M12 3 4 7v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9.5 12.5 11 14l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
