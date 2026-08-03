// Defines the sun band that closes a scrolling page.
/**
 * A full-bleed band of brand colour rather than a grey line on paper. This is
 * the one place a large field of yellow costs nothing, because there is no
 * action next to it for the colour to compete with.
 *
 * The band runs edge to edge while its content keeps the page measure, so the
 * colour reaches the viewport but the type still lines up with everything above.
 *
 * Ink, not tertiary: tertiary on sun is 3.42:1 and fails AA. Ink on sun is 11:1,
 * the same pairing the primary pill already uses.
 */
export function SiteFooter() {
  return (
    <footer className="w-full bg-sun">
      <div className="mx-auto flex w-full flex-col items-center px-(--gutter) py-8 lg:w-220 lg:py-12">
        <p className="font-sans text-(length:--t-footer) font-medium text-ink">
          Kahayag · Made in the Philippines · © 2026
        </p>
      </div>
    </footer>
  );
}
