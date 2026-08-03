/**
 * Rewrites every identifier in an inline SVG so two copies can share a page.
 *
 * A `<style>` inside an inline `<svg>` is *not* scoped — its selectors and
 * keyframes leak into the whole document, and element ids referenced by
 * `url(#…)` collide. Suffixing each class, id and keyframe name with a
 * per-instance token makes the leaked rules unable to match anything else.
 *
 * Inlining (rather than an `<img src>`) is what makes the animations replay:
 * the browser shares one SVG document, and therefore one animation timeline,
 * across every `<img>` pointing at the same URL, so a remount reuses the
 * already-finished timeline and nothing moves.
 */
const ID_ATTR = /id="([^"]+)"/g;
const CLASS_ATTR = /class="([^"]+)"/g;
const KEYFRAMES = /@keyframes\s+([\w-]+)/g;

/** Longest first, so "sun" cannot partially rewrite "sunrise". */
const byLengthDesc = (names: Set<string>) =>
  [...names].sort((a, b) => b.length - a.length);

/** Matches the token only when it is not part of a longer identifier. */
const boundary = (token: string, prefix = "") =>
  new RegExp(
    `${prefix}${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`,
    "g",
  );

export function scopeSvg(markup: string, uid: string): string {
  const ids = new Set<string>();
  const classes = new Set<string>();
  const keyframes = new Set<string>();

  for (const [, value] of markup.matchAll(ID_ATTR)) ids.add(value);
  for (const [, value] of markup.matchAll(CLASS_ATTR)) {
    for (const name of value.split(/\s+/).filter(Boolean)) classes.add(name);
  }
  for (const [, value] of markup.matchAll(KEYFRAMES)) keyframes.add(value);

  let out = markup;

  for (const id of byLengthDesc(ids)) {
    out = out.replace(boundary(id, 'id="'), `id="${id}-${uid}`);
    out = out.replace(boundary(id, "url\\(#"), `url(#${id}-${uid}`);
  }

  for (const name of byLengthDesc(classes)) {
    // Selector occurrences inside <style>.
    out = out.replace(boundary(name, "\\."), `.${name}-${uid}`);
    // Attribute occurrences on elements, including multi-class values.
    out = out.replace(
      new RegExp(`class="([^"]*)"`, "g"),
      (_match, value: string) =>
        `class="${value
          .split(/\s+/)
          .filter(Boolean)
          .map((cls) => (cls === name ? `${cls}-${uid}` : cls))
          .join(" ")}"`,
    );
  }

  for (const name of byLengthDesc(keyframes)) {
    out = out.replace(boundary(name), `${name}-${uid}`);
  }

  return out;
}

/**
 * Returns the mark's own "hold still" rules, so an entrance can be suppressed
 * without the component having to know which layers move.
 *
 * Each mark already declares its still state in a
 * `@media(prefers-reduced-motion:reduce)` block. This lifts the `animation:none`
 * rules out of that block and hands them back for unconditional use. Rules that
 * merely hide a layer (the glint) are left behind — freezing an entrance should
 * not strip ambient detail.
 *
 * Call it *after* `scopeSvg`, so the selectors are already instance-scoped.
 */
export function stillEntranceCss(scopedMarkup: string): string {
  const open = scopedMarkup.indexOf("@media(prefers-reduced-motion:reduce){");
  if (open === -1) return "";

  let depth = 0;
  let start = -1;
  for (
    let i = scopedMarkup.indexOf("{", open);
    i < scopedMarkup.length;
    i += 1
  ) {
    const ch = scopedMarkup[i];
    if (ch === "{") {
      depth += 1;
      if (depth === 1) start = i + 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = scopedMarkup.slice(start, i);
        return (body.match(/[^{}]+\{[^{}]*\}/g) ?? [])
          .filter((rule) => rule.includes("animation:none"))
          .join("");
      }
    }
  }

  return "";
}

/**
 * Strips the file's own accessible name. These marks sit beside text that
 * already names the brand, so they are decoration.
 */
export function decorativeSvg(markup: string): string {
  return markup
    .replace(' role="img"', "")
    .replace(/ aria-label="[^"]*"/, ' aria-hidden="true" focusable="false"');
}
