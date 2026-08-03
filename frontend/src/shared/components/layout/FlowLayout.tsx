// Defines the two-pane shell shared by every step of the assessment flow.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button, ButtonLink, CtaArrow, Eyebrow } from "../ui";
import { cn } from "../../lib/cn";

/**
 * A fixed rail beside a full-height pane on desktop; one column on mobile, where
 * the pane sits *between* the copy and the action rather than above both.
 *
 * Both modes share a single DOM. On mobile the screen is exactly one viewport
 * tall — copy and pane scroll inside it while the action bar stays pinned, so
 * the way forward is never below the fold. On desktop the scrolling wrapper
 * becomes `display: contents` and its children drop straight into the grid.
 *
 * The rail splits into `lead` (above the pane on mobile) and `children` (below
 * it), which is the only way to get one desktop order and a different mobile
 * one without duplicating the markup.
 */
export function FlowLayout({
  step,
  title,
  lead,
  pane,
  children,
  beforeCta,
  backHref,
  backLabel,
  nextHref,
  nextLabel,
  nextDisabled = false,
  nextLoading = false,
  onNext,
  paneClassName,
  railClassName,
  titleClassName,
}: {
  step: string;
  title: ReactNode;
  /** Rail content that stays above the pane on mobile. */
  lead?: ReactNode;
  /** The right-hand surface: a map, a canvas, a figure. */
  pane: ReactNode;
  /** Rail content that falls below the pane on mobile. */
  children?: ReactNode;
  /** Shares the action bar, directly above the button, at every width. */
  beforeCta?: ReactNode;
  backHref?: string;
  backLabel?: string;
  nextHref?: string;
  nextLabel: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  /** When set, the action runs this instead of navigating to `nextHref`. */
  onNext?: () => void | Promise<void>;
  paneClassName?: string;
  /** Rail width and rhythm, for the screens that need a wider column. */
  railClassName?: string;
  titleClassName?: string;
}) {
  const railColumn = cn("flex flex-col gap-5 px-6 lg:px-0", railClassName);
  const blocked = nextDisabled || nextLoading;

  return (
    <main
      id="main"
      className={cn(
        "flex h-svh flex-col bg-paper",
        "lg:grid lg:grid-cols-[26.25rem_1fr] lg:grid-rows-[auto_auto_1fr_auto] lg:pt-14 lg:pb-12",
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:contents">
        <div
          className={cn(
            railColumn,
            "pt-10 lg:col-start-1 lg:row-start-1 lg:pt-0 lg:pr-10 lg:pl-12",
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

          <Eyebrow>{step}</Eyebrow>

          <h1
            className={cn(
              "w-full font-serif text-[36px] leading-tight font-medium text-balance text-ink lg:text-[46px]",
              titleClassName,
            )}
          >
            {title}
          </h1>

          {lead}
        </div>

        <div
          className={cn(
            "flex min-h-56 flex-1 px-6 py-5",
            "lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:min-h-0 lg:px-0 lg:py-0",
            paneClassName,
          )}
        >
          {pane}
        </div>

        <div
          className={cn(
            railColumn,
            // The grid sets no row gap, so this block buys its own air under the
            // heading on desktop and collapses entirely when it has no content.
            "pb-2 empty:hidden lg:col-start-1 lg:row-start-2 lg:pt-8 lg:pr-10 lg:pb-0 lg:pl-12",
          )}
        >
          {children}
        </div>
      </div>

      {/* Pushes the action bar to the foot of the rail on desktop only. */}
      <div className="hidden lg:col-start-1 lg:row-start-3 lg:block" />

      <div
        className={cn(
          "flex shrink-0 flex-col gap-3 border-t border-hairline bg-paper px-6 pt-4 pb-6",
          "lg:col-start-1 lg:row-start-4 lg:border-t-0 lg:pt-0 lg:pr-10 lg:pb-0 lg:pl-12",
        )}
      >
        {beforeCta}

        {onNext ? (
          <Button
            fullWidth
            disabled={blocked}
            aria-disabled={blocked || undefined}
            onClick={onNext}
          >
            {nextLabel}
            <CtaArrow />
          </Button>
        ) : (
          <ButtonLink to={nextHref ?? "#"} fullWidth disabled={blocked}>
            {nextLabel}
            <CtaArrow />
          </ButtonLink>
        )}
      </div>
    </main>
  );
}
