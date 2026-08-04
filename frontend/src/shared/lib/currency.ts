// Defines peso formatting shared across assessment and results screens.
export const peso = (value: number) =>
  `₱${Math.round(value).toLocaleString("en-PH")}`;

export const pesoRange = (low: number, high: number) =>
  `${peso(low)}–${peso(high)}`;

export function pesoCompact(value: number): string {
  const rounded = Math.round(value);
  if (rounded >= 1_000_000) {
    const millions = rounded / 1_000_000;
    const formatted =
      millions >= 100
        ? millions.toFixed(0)
        : millions.toFixed(1).replace(/\.0$/, "");
    return `₱${formatted}M`;
  }
  return peso(rounded);
}

export const pesoRangeCompact = (low: number, high: number) =>
  `${pesoCompact(low)}–${pesoCompact(high)}`;
