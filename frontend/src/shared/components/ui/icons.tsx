// Defines the inline icon set. Inlined rather than fetched so icons ship with
// the bundle, scale cleanly, and cost no request.

/**
 * Map pin. Drawn with its point at the bottom centre of the box, so an element
 * anchored to a coordinate lines up on the point rather than the middle of the
 * teardrop.
 */
export function PinIcon({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M12 22C12 22 20 15.4 20 9.5C20 5.08 16.42 1.5 12 1.5C7.58 1.5 4 5.08 4 9.5C4 15.4 12 22 12 22Z"
        fill="currentColor"
      />
      <circle cx="12" cy="9.3" r="2.9" fill="white" />
    </svg>
  );
}
