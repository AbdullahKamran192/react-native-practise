// Display only: never use the formatted text for persistence or calculations.
export function formatNumber(value: number | string | null | undefined): string {
  if (value == null || (typeof value === "string" && !value.trim())) return "—";
  const number = Number(typeof value === "string" ? value.trim().replace(",", ".") : value);
  if (!Number.isFinite(number)) return "—";
  return (Math.abs(number) < 0.05 ? 0 : number).toLocaleString("en-GB", {
    maximumFractionDigits: 1,
  });
}
