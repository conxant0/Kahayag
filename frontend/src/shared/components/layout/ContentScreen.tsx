// Defines the centred editorial column behind the long-form screens.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Eyebrow } from "../ui";
import { cn } from "../../lib/cn";

export type ContentScreenCtaSticky = "mobile" | "always";

/**
 * A single reading column for the screens that explain rather than collect.
 *
 * These pages are long, so the action is pinned to the foot of the viewport on
 * mobile — sticky rather than fixed, so it releases into the flow at the end of
 * the column instead of covering the last paragraph forever.
 *
 * `aside` opens a second column on wide screens. The mobile frames are a single
 * scroll out of necessity; running that same stack on a desktop leaves two
 * thirds of the viewport empty and pushes the payoff far below the fold, so the
 * longest screens split instead of simply growing taller.
 */
export function ContentScreen({
  eyebrow,
  title,
  children,
  aside,
  cta,
  ctaSticky = "mobile",
  backHref,
  backLabel,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  /** Second column from `xl` up; stacks under `children` below that. */
  aside?: ReactNode;
  cta?: ReactNode;
  /**
   * `"mobile"` releases the action into the column on desktop. `"always"` keeps
   * it a bottom bar at every width, which the two longest screens want so the
   * action never scrolls out of reach.
   */
  ctaSticky?: ContentScreenCtaSticky;
  backHref?: string;
  backLabel?: string;
  className?: string;
}) {
  const split = Boolean(aside);

  return (
    <div className="flex min-h-svh flex-col items-center bg-paper">
      <main
        id="main"
        className={cn(
          "flex w-full flex-col gap-7 px-6 pt-8 pb-0",
          "lg:w-159 lg:gap-8 lg:px-10 lg:pt-7.75 lg:pb-16",
          split && "xl:w-290 xl:gap-10",
          className,
        )}
      >
        {backHref && backLabel ? (
          <Link
            to={backHref}
            className="w-fit font-sans text-sm font-semibold text-cobalt hover:underline"
          >
            ← {backLabel}
          </Link>
        ) : null}

        <Eyebrow className="lg:text-[13px] lg:tracking-[1.8px]">
          {eyebrow}
        </Eyebrow>

        <h1
          className={cn(
            "w-full font-serif text-[36px] leading-tight font-medium text-balance text-ink lg:text-[44px]",
            split && "xl:max-w-[16ch]",
          )}
        >
          {title}
        </h1>

        {split ? (
          <div className="flex flex-col gap-7 lg:gap-8 xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-20">
            <div className="flex flex-col gap-7 lg:gap-8">{children}</div>
            <div className="flex flex-col gap-7 lg:gap-8">{aside}</div>
          </div>
        ) : (
          children
        )}

        {cta ? (
          <div
            className={cn(
              // Bleeds to the column edges so the bar reads as a floor the page
              // scrolls under, not a card floating over it.
              "sticky bottom-0 z-10 -mx-6 mt-2 flex flex-col gap-3 border-t border-hairline",
              "bg-paper px-6 pt-4 pb-6",
              ctaSticky === "always"
                ? "lg:-mx-10 lg:mt-4 lg:px-10 lg:pt-5 lg:pb-7"
                : "lg:static lg:mx-0 lg:mt-0 lg:border-t-0 lg:bg-transparent lg:p-0",
              // On the split layout the bar stays full width but the action
              // itself centres over the reading column.
              split && ctaSticky !== "always" && "xl:mx-auto xl:w-160",
              split && ctaSticky === "always" && "xl:*:mx-auto xl:*:w-160",
            )}
          >
            {cta}
          </div>
        ) : null}
      </main>
    </div>
  );
}
