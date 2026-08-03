/**
 * Brand assets.
 *
 * Everything lives under `src/` rather than `public/` so Vite fingerprints it —
 * these files change rarely and are cached hard, so a content hash is what makes
 * a future change actually reach people.
 *
 * The two animated marks are imported `?raw`: they are inlined into the DOM so
 * their CSS timelines replay on every mount. See `shared/lib/scopeSvg`.
 */
export { default as HERO_BG } from "./hero-bg.jpg";
export { default as KAHAYAG_MARK } from "./kahayag-mark.png";

export { default as kahayagSunriseMarkup } from "./kahayag-sunrise.svg?raw";
export { default as kahayagLoaderMarkup } from "./kahayag-logo-loader.svg?raw";
