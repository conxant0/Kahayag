// Resolves catalog product image URLs for design canvas components.
import type { ComponentSlot, DesignComponent } from "../../shared/api/types";

const REMOTE_CATALOG_BASE = "https://assets.kahayag.dev/catalog";
const LOCAL_CATALOG_BASE = "/catalog";
const LOCAL_CATALOG_DEFAULT = "default";

const CATALOG_IMAGE_FOLDERS: Partial<Record<ComponentSlot, string>> = {
  panel: "panels",
  inverter: "inverters",
  battery: "batteries",
  protection: "protections",
  structure: "mounting",
  electrical: "cabling",
  installation: "misc",
};

function useLocalCatalogImages(): boolean {
  return import.meta.env.VITE_CATALOG_IMAGES === "local";
}

function catalogAssetExtension(): string {
  return useLocalCatalogImages() ? "png" : "jpg";
}

export function categoryDefaultAssetUrl(folder: string): string {
  const base = useLocalCatalogImages() ? LOCAL_CATALOG_BASE : REMOTE_CATALOG_BASE;
  return `${base}/${folder}/${LOCAL_CATALOG_DEFAULT}.${catalogAssetExtension()}`;
}

export function catalogAssetUrl(folder: string, catalogId: string): string {
  if (useLocalCatalogImages()) {
    return categoryDefaultAssetUrl(folder);
  }
  return `${REMOTE_CATALOG_BASE}/${folder}/${catalogId}.jpg`;
}

export function normalizeProductImageUrl(url: string): string {
  if (!useLocalCatalogImages()) {
    return url;
  }
  const remotePrefix = `${REMOTE_CATALOG_BASE}/`;
  if (url.startsWith(remotePrefix)) {
    const folder = url.slice(remotePrefix.length).split("/")[0];
    if (folder) {
      return categoryDefaultAssetUrl(folder);
    }
  }
  if (url.startsWith(`${LOCAL_CATALOG_BASE}/`)) {
    const folder = url.slice(`${LOCAL_CATALOG_BASE}/`.length).split("/")[0];
    if (folder) {
      return categoryDefaultAssetUrl(folder);
    }
  }
  return url;
}

export function resolveComponentImageUrl(component: DesignComponent): string | null {
  const folder = CATALOG_IMAGE_FOLDERS[component.slot];
  if (!folder) {
    return null;
  }

  if (useLocalCatalogImages()) {
    return categoryDefaultAssetUrl(folder);
  }

  if (component.product_image) {
    return component.product_image;
  }
  if (!component.catalog_id) {
    return null;
  }
  return catalogAssetUrl(folder, component.catalog_id);
}

export const PRODUCT_IMAGE_SIZE = {
  sm: "size-10",
  thumb: "size-14 shrink-0",
  md: "h-16 w-full",
  lg: "h-24 w-full",
} as const;
