// Defines the inline icon set. Inlined rather than fetched so icons ship with
// the bundle, scale cleanly, and cost no request.

/**
 * Camera, 20x18. Drawn on a coloured disc, so the body is white and only the
 * lens takes a colour — which lets the same icon serve the default and error
 * states of the upload card.
 */
export function CameraIcon({ lens = "#2144C7" }: { lens?: string }) {
  return (
    <svg
      width="20"
      height="18"
      viewBox="0 0 20 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6.6 2.4L7.8 0.4H12.2L13.4 2.4H17C17.5304 2.4 18.0391 2.61071 18.4142 2.98579C18.7893 3.36086 19 3.86957 19 4.4V15C19 15.5304 18.7893 16.0391 18.4142 16.4142C18.0391 16.7893 17.5304 17 17 17H3C2.46957 17 1.96086 16.7893 1.58579 16.4142C1.21071 16.0391 1 15.5304 1 15V4.4C1 3.86957 1.21071 3.36086 1.58579 2.98579C1.96086 2.61071 2.46957 2.4 3 2.4H6.6Z"
        fill="white"
      />
      <path
        d="M10 13C11.8778 13 13.4 11.4778 13.4 9.6C13.4 7.72223 11.8778 6.2 10 6.2C8.12223 6.2 6.6 7.72223 6.6 9.6C6.6 11.4778 8.12223 13 10 13Z"
        fill={lens}
      />
    </svg>
  );
}

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
