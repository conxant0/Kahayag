// Resolves catalog product image URLs for design canvas components.
import type { ComponentSlot, DesignComponent } from "../../shared/api/types";

const CATALOG_IMAGE_FOLDERS: Partial<Record<ComponentSlot, string>> = {
  panel: "panels",
  inverter: "inverters",
  battery: "batteries",
  protection: "protections",
  structure: "mounting",
  electrical: "cabling",
  installation: "misc",
};

export function resolveComponentImageUrl(component: DesignComponent): string | null {
  if (component.product_image) {
    return component.product_image;
  }
  if (!component.catalog_id) {
    return null;
  }
  const folder = CATALOG_IMAGE_FOLDERS[component.slot];
  if (!folder) {
    return null;
  }
  return `https://assets.kahayag.dev/catalog/${folder}/${component.catalog_id}.jpg`;
}

export const PRODUCT_IMAGE_SIZE = {
  sm: "size-10",
  md: "h-16 w-full",
  lg: "h-24 w-full",
} as const;
