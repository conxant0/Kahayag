// Defines the centered, equal-width compare card grid.
import type { ReactNode } from "react";

export const COMPARE_CARDS_PER_ROW = 4;

export function CompareCardSlot({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-w-0 flex-col">{children}</div>;
}

export function CompareCardsGrid({
  children,
  ariaLabel = "Build options",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className="mx-auto grid w-full grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6"
    >
      {children}
    </section>
  );
}

export const compareFlipCardClass =
  "group/card flex h-full w-full min-w-0 flex-col [perspective:1200px]";

export const compareFlipInnerClass =
  "relative flex h-full min-h-full flex-1 flex-col cursor-pointer text-left outline-none transition-[transform,box-shadow] duration-500 ease-brand [transform-style:preserve-3d] focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-2 focus-visible:ring-offset-paper group-hover/card:-translate-y-1.5 group-hover/card:shadow-[0px_18px_36px_rgba(26,23,18,0.12)]";

export const compareFlipFaceClass =
  "relative flex h-full flex-1 flex-col rounded-[20px] bg-white p-6 [backface-visibility:hidden]";

export const compareFlipFaceBackClass =
  "absolute inset-0 flex h-full flex-col rounded-[20px] bg-white p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]";

export const compareUtilityCardClass =
  "flex h-full w-full flex-col rounded-[20px] border border-dashed border-[#d8d2c4] bg-white px-6 py-6";

export const compareMoneyClass =
  "mt-1.5 break-words font-serif text-[1.25rem] font-medium tabular-nums leading-tight tracking-tight text-ink";
