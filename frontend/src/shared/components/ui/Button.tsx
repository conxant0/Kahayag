// Defines the pill button in its three weights, as a button and as a route link.
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LinkProps } from "react-router-dom";

import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * Shape and motion shared by all three weights. Hover lifts the pill 2px and a
 * press settles it back down.
 *
 * The transition lists its properties rather than using `transition-colors`,
 * which in Tailwind v4 also covers `outline-color` — that would fade the focus
 * ring in, and a focus ring has to be there the instant focus lands.
 */
const shellClasses = [
  "group/btn inline-flex select-none items-center justify-center rounded-pill",
  "font-sans font-semibold will-change-transform",
  "transition-[background-color,border-color,color,transform,box-shadow]",
  "duration-150 ease-brand hover:-translate-y-0.5 active:translate-y-0",
  "motion-reduce:transform-none motion-reduce:transition-none",
  "disabled:pointer-events-none disabled:opacity-45 disabled:hover:translate-y-0",
].join(" ");

/**
 * Yellow acts, so `primary` is the only sun-painted control and a screen should
 * carry exactly one. `secondary` is cobalt, which reads as the parallel route
 * rather than the way forward. `ghost` is the small in-place control that
 * adjusts something without ever ending a flow.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    "h-14 gap-2 bg-sun text-base text-ink",
    "hover:bg-sun-hover active:bg-sun-hover",
    "hover:shadow-[0_4px_0_0_var(--color-sun-hover)] active:shadow-none",
  ].join(" "),
  secondary: [
    "h-14 gap-2 border-[1.5px] border-cobalt bg-cobalt-wash text-base text-cobalt",
    "hover:bg-cobalt hover:text-paper",
  ].join(" "),
  ghost: [
    "gap-2 border border-hairline bg-white px-4 py-2.5 text-[13px] text-secondary",
    "hover:border-tertiary hover:text-ink",
  ].join(" "),
};

/**
 * The ghost pill is drawn 37px tall. Inflating the painted box to reach a 44px
 * pointer target would miss the design by 7px, so an invisible centred strip
 * carries the target instead and the pixels stay right.
 */
const touchTargetClasses = [
  "relative after:absolute after:inset-x-0 after:top-1/2",
  "after:h-11 after:-translate-y-1/2 after:content-['']",
].join(" ");

function pillClasses(
  variant: ButtonVariant,
  fullWidth: boolean,
  className?: string,
) {
  return cn(
    shellClasses,
    variantClasses[variant],
    variant === "ghost" && touchTargetClasses,
    fullWidth && "w-full",
    className,
  );
}

type PillProps = {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

export type ButtonProps = PillProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

export type ButtonLinkProps = PillProps &
  Omit<LinkProps, "to" | "children" | "className"> & {
    to: string;
    /** Blocks the link. See `ButtonLink` for what that has to cover. */
    disabled?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      fullWidth = false,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={pillClasses(variant, fullWidth, className)}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/**
 * The same pill rendered as a route link, for every "next step" CTA.
 *
 * An anchor has no `disabled`, and dimming one does not stop it working:
 * `pointer-events-none` blocks the mouse but leaves the link in the tab order,
 * and Enter on a focused anchor still navigates. Blocking therefore takes all
 * three routes at once — out of the tab order, pointer events off, and the
 * click cancelled, which also covers Enter because that fires a click.
 */
export function ButtonLink({
  to,
  variant = "primary",
  fullWidth = false,
  className,
  children,
  disabled = false,
  onClick,
  tabIndex,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      {...rest}
      to={to}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : tabIndex}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={cn(
        pillClasses(variant, fullWidth, className),
        disabled && "pointer-events-none opacity-45",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * The trailing arrow on a forward CTA, nudging right on hover so the pill reads
 * as onward motion. Decorative — the label already says where it goes.
 */
export function CtaArrow() {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block transition-transform duration-150 ease-brand",
        "group-hover/btn:translate-x-0.5 motion-reduce:transform-none",
      )}
    >
      →
    </span>
  );
}
