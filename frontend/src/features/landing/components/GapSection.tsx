import { useEffect, useId, useRef, useState } from "react";

import {
  GAP_PAYBACK,
  GAP_QUOTES,
  GAP_ROOF,
} from "../../../shared/assets/landing";
import { Reveal, Rule } from "../../../shared/components/ui";
import { useInView } from "../../../shared/hooks/useInView";
import { useMediaQuery } from "../../../shared/hooks/useMediaQuery";
import { cn } from "../../../shared/lib/cn";

import { EditorialSection } from "./EditorialSection";

/**
 * The three things a homeowner cannot see today — Figma 2141:2 / 2169:37.
 *
 * Each claim carries the evidence behind it. The line stays the headline act;
 * the photograph is held back until asked for, so the section still reads as
 * three sentences on paper at first glance.
 *
 * Open is sticky: a row stays open until another one takes over, or until it is
 * clicked shut. Closing on pointer-leave made the section flicker every time the
 * cursor crossed it, and the evidence is worth reading after the pointer has
 * moved on.
 */
const GAPS = [
  {
    id: "quotes",
    claim: "Quotes you can’t compare.",
    detail:
      "Three installers, three formats, three sets of assumptions. Nothing lines up long enough to choose.",
    image: GAP_QUOTES,
    alt: "A stack of mismatched quote forms and paperwork spread across a pale wooden table.",
  },
  {
    id: "roof",
    claim: "A roof you’ve never measured.",
    detail:
      "Nobody has told you how much of it is usable, which way it faces, or where the shade lands at 3pm.",
    image: GAP_ROOF,
    alt: "A drone photograph looking down onto the roof of a house.",
  },
  {
    id: "payback",
    claim: "Payback math you can’t see.",
    detail:
      "The savings figure arrives without the working. You are asked to trust the number and sign.",
    image: GAP_PAYBACK,
    alt: "A card terminal on an amber surface printing a long, blank receipt.",
  },
] as const;

/** Long enough that sweeping the pointer across the list opens nothing. */
const HOVER_INTENT_MS = 110;

/**
 * Plus turning to minus: two cobalt hairlines, one of which unrotates. Cheaper
 * to read than an arrow, and it survives being 1.6px on desktop.
 */
function OpenMark({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative grid size-6 shrink-0 place-items-center lg:size-9"
    >
      <span className="absolute h-(--rule-h) w-3.5 bg-cobalt lg:w-5" />
      <span
        className={cn(
          "absolute h-(--rule-h) w-3.5 bg-cobalt transition-transform duration-300 ease-brand motion-reduce:transition-none lg:w-5",
          open ? "rotate-0" : "rotate-90",
        )}
      />
    </span>
  );
}

export function GapSection() {
  // The first row starts open, on every breakpoint. A section of three closed
  // rows gives no sign that there is anything behind them; showing one is what
  // makes the other two legible as things you can open.
  const [openId, setOpenId] = useState<string | null>(GAPS[0].id);
  const panelPrefix = useId();
  const intent = useRef(0);

  // The photographs are fetched as the section approaches rather than when a
  // row opens: a lazy image inside a collapsed row loads *during* the reveal,
  // which is exactly when it can least afford to.
  const [listRef, near] = useInView<HTMLUListElement>({
    threshold: 0,
    rootMargin: "0px 0px 40% 0px",
  });

  // Hover is an affordance, not a layout: where a pointer exists the evidence
  // opens under it, and where one does not the row has to be tapped. Asking the
  // device rather than the width keeps a touchscreen laptop honest.
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");

  useEffect(() => () => window.clearTimeout(intent.current), []);

  const open = (id: string) => {
    window.clearTimeout(intent.current);
    setOpenId(id);
  };

  const openWithIntent = (id: string) => {
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(() => setOpenId(id), HOVER_INTENT_MS);
  };

  const cancelIntent = () => window.clearTimeout(intent.current);

  return (
    <EditorialSection
      eyebrow="The gap"
      title="Stop guessing. Start with your roof."
      titleSize="gap"
      titleId="the-gap"
      className="pt-10 pb-8 lg:pt-[89.6px] lg:pb-[25.6px]"
    >
      <ul
        ref={listRef}
        className="flex w-full list-none flex-col gap-3 p-0 lg:gap-[19.2px]"
      >
        {GAPS.map((gap, index) => {
          const isOpen = openId === gap.id;
          const panelId = `${panelPrefix}-${gap.id}`;

          return (
            <Reveal
              as="li"
              key={gap.id}
              delay={index * 70}
              className="flex flex-col gap-3 lg:gap-[19.2px]"
            >
              <Rule />

              <div
                onPointerEnter={
                  canHover ? () => openWithIntent(gap.id) : undefined
                }
                onPointerLeave={canHover ? cancelIntent : undefined}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => (isOpen ? setOpenId(null) : open(gap.id))}
                  onFocus={canHover ? () => open(gap.id) : undefined}
                  className="group flex w-full cursor-pointer items-baseline gap-3 bg-transparent p-0 text-left lg:gap-5"
                >
                  {/* An index rather than a bullet: three things, counted. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 font-sans text-(length:--t-micro) font-semibold tracking-(--t-micro-track) tabular-nums",
                      "transition-colors duration-200 ease-brand motion-reduce:transition-none",
                      isOpen ? "text-cobalt" : "text-tertiary-ink",
                    )}
                  >
                    0{index + 1}
                  </span>

                  <span
                    className={cn(
                      "font-sans text-(length:--t-list) transition-colors duration-200 ease-brand motion-reduce:transition-none",
                      isOpen ? "text-ink" : "text-secondary",
                    )}
                  >
                    {gap.claim}
                  </span>

                  <span className="ml-auto self-center">
                    <OpenMark open={isOpen} />
                  </span>
                </button>

                {/* 0fr -> 1fr is the one height animation that does not need a
                 * measured pixel value, so the row grows with its own copy. */}
                <div
                  id={panelId}
                  inert={!isOpen}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-460 ease-brand motion-reduce:transition-none",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <figure className="m-0 flex flex-col gap-3 pt-3.5 lg:gap-[19.2px] lg:pt-[22.4px]">
                      {near ? (
                        <img
                          src={gap.image}
                          alt={gap.alt}
                          width={1600}
                          height={1067}
                          decoding="async"
                          className={cn(
                            "aspect-3/2 w-full rounded-(--card-radius) object-cover",
                            "transition-[opacity,translate] duration-500 ease-brand motion-reduce:transition-none",
                            isOpen
                              ? "translate-y-0 opacity-100 delay-75"
                              : "translate-y-2 opacity-0",
                          )}
                        />
                      ) : (
                        <div className="aspect-3/2 w-full rounded-(--card-radius) bg-hairline" />
                      )}

                      <figcaption className="font-serif text-(length:--t-body) text-secondary italic">
                        {gap.detail}
                      </figcaption>
                    </figure>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </ul>
    </EditorialSection>
  );
}
