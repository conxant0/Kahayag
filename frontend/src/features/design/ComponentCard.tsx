import { useState } from "react";

import { Chip, Eyebrow } from "../../shared/components/ui";
import { peso } from "../../shared/lib/currency";
import type { DesignComponent, RejectionReason } from "../../shared/api/types";
import { cn } from "../../shared/lib/cn";

export function ComponentCard({
  component,
  rejections = [],
}: {
  component: DesignComponent;
  rejections?: RejectionReason[];
}) {
  const [showDetails, setShowDetails] = useState(false);
  const hasRejections = rejections.length > 0;

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-hairline bg-white p-4 shadow-sm",
        component.qty === 0 && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Eyebrow className="text-[11px]">{component.summary}</Eyebrow>
          <h3 className="font-serif text-lg text-ink">
            {component.brand} {component.model}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1">
          {component.badges.map((badge) => (
            <Chip key={badge} selected>
              {badge}
            </Chip>
          ))}
        </div>
      </div>

      {component.qty > 0 ? (
        <p className="font-sans text-sm text-secondary">
          {component.qty} {component.unit} · {peso(component.line_total_php)}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="font-sans text-sm font-semibold text-cobalt hover:underline"
          onClick={() => setShowDetails((open) => !open)}
        >
          {showDetails ? "Hide details" : "View details"}
        </button>
        {hasRejections ? (
          <span
            className="font-sans text-sm text-secondary"
            title={rejections[0]?.message}
          >
            Why not another? · {rejections.length} rejection
            {rejections.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {showDetails ? (
        <dl className="grid gap-1 border-t border-hairline pt-2 font-sans text-sm">
          {Object.entries(component.specs).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="text-secondary">{key}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
          {component.warranty_note ? (
            <div className="pt-1 text-secondary">{component.warranty_note}</div>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}
