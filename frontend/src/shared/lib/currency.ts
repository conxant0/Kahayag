// Defines peso formatting shared across assessment and results screens.
export const peso = (value: number) =>
  `₱${Math.round(value).toLocaleString("en-PH")}`;
