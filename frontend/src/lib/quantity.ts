// Decimal values stay exact; Number is used only for slider indexes.
export const SCALE = 10n ** 12n;
export function decimalUnits(value: string): bigint | null {
  const match = /^(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(value.trim());
  if (!match || value.length > 64) return null;
  const exponent = Number(match[3] || 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 40) return null;
  const digits = match[1] + (match[2] || "");
  const power = 12 + exponent - (match[2]?.length || 0);
  if (power < 0) {
    const divisor = 10n ** BigInt(-power),
      whole = BigInt(digits);
    return whole % divisor === 0n ? whole / divisor : null;
  }
  return BigInt(digits) * 10n ** BigInt(power);
}
export function decimalString(units: bigint): string {
  const whole = units / SCALE,
    fraction = (units % SCALE).toString().padStart(12, "0").replace(/0+$/, "");
  return `${whole}${fraction ? "." + fraction : ""}`;
}
export function cryptoStops(step: bigint, cap = 10000n * SCALE): bigint[] {
  if (step <= 0n) return [];
  const maximum = cap / step > 0n ? cap / step : 1n;
  const stops: bigint[] = [];
  for (let decade = 1n; decade <= maximum; decade *= 10n) {
    for (let digit = 10n; digit < 100n; digit++) {
      const units = (digit * decade) / 10n;
      if (units > maximum) break;
      const amount = units * step;
      if (amount !== stops[stops.length - 1]) stops.push(amount);
    }
  }
  if (stops[stops.length - 1] !== maximum * step) stops.push(maximum * step);
  return stops;
}
