// Renders a catalog product photo with slot-icon fallback.
import { useState } from "react";

import type { DesignComponent } from "../../shared/api/types";
import { cn } from "../../shared/lib/cn";
import { CanvasSlotIcon, SLOT_ACCENT } from "./canvasSlotIcons";
import { PRODUCT_IMAGE_SIZE, resolveComponentImageUrl } from "./componentImageUrl";

export function ComponentProductImage({
  component,
  size = "md",
  className,
}: {
  component: DesignComponent;
  size?: keyof typeof PRODUCT_IMAGE_SIZE;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = resolveComponentImageUrl(component);
  const accent = SLOT_ACCENT[component.slot];
  const frameClass = PRODUCT_IMAGE_SIZE[size];

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[10px]",
          accent.bg,
          frameClass,
          className,
        )}
      >
        <CanvasSlotIcon
          slot={component.slot}
          size={size === "sm" ? 18 : size === "thumb" ? 24 : size === "lg" ? 36 : 28}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] bg-[#f7f4ed]",
        frameClass,
        className,
      )}
    >
      <img
        src={src}
        alt={`${component.brand} ${component.model}`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-full object-contain p-1.5"
      />
    </div>
  );
}
