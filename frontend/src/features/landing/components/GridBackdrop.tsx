/**
 * A faint graph-paper grid behind the whole landing page.
 *
 * Fixed and completely still: the page slides over it rather than the grid
 * travelling with the scroll. That is the whole effect — the sections read as
 * sheets moving across a sheet of graph paper that never moves.
 *
 * Being static means no scroll listener, no transform, and nothing to schedule
 * per frame; it is one painted layer for the life of the page. It also has
 * nothing to disable under prefers-reduced-motion, because it never animates.
 *
 * It must sit above the page background but below the content, so the landing
 * wrapper deliberately carries no background of its own — an opaque background
 * there would paint straight over this.
 */
const TILE = 64;

const LINE = "rgb(26 25 23 / 0.09)";

export function GridBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundSize: `${TILE}px ${TILE}px`,
        backgroundImage:
          `linear-gradient(to right, ${LINE} 1px, transparent 1px),` +
          `linear-gradient(to bottom, ${LINE} 1px, transparent 1px)`,
      }}
    />
  );
}
