#!/usr/bin/env node
// Generates one default SVG placeholder per catalog component type.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputRoot = path.join(__dirname, "../public/catalog");

const CATEGORIES = [
  { folder: "panels", label: "Solar panel", fill: "#fff6dd", ink: "#9a7200" },
  { folder: "inverters", label: "Inverter", fill: "#fff4cc", ink: "#7a5c00" },
  { folder: "batteries", label: "Battery", fill: "#edf3ff", ink: "#2f58a6" },
  { folder: "protections", label: "Protection", fill: "#f2eee4", ink: "#6b6560" },
  { folder: "mounting", label: "Mounting", fill: "#f2eee4", ink: "#6b6560" },
  { folder: "cabling", label: "Cabling", fill: "#f2eee4", ink: "#6b6560" },
  { folder: "misc", label: "Installation", fill: "#f2eee4", ink: "#6b6560" },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function placeholderSvg({ label, fill, ink }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240" role="img" aria-label="${escapeXml(label)}">
  <rect width="240" height="240" rx="18" fill="${fill}" />
  <rect x="18" y="18" width="204" height="204" rx="14" fill="#ffffff" fill-opacity="0.55" />
  <text x="120" y="118" text-anchor="middle" font-family="Geist, system-ui, sans-serif" font-size="16" font-weight="700" fill="${ink}">${escapeXml(label)}</text>
  <text x="120" y="144" text-anchor="middle" font-family="Geist, system-ui, sans-serif" font-size="10" font-weight="500" fill="#6b6560">Replace with default.jpg</text>
</svg>
`;
}

for (const category of CATEGORIES) {
  const outDir = path.join(outputRoot, category.folder);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "default.svg"),
    placeholderSvg(category),
    "utf8",
  );
}

console.log(`Wrote ${CATEGORIES.length} default catalog placeholders to ${outputRoot}`);
