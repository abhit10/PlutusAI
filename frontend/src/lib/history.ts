import type { PortfolioChange, Portfolio, Holding } from "./types";
import { formatInr, formatQty } from "./format";
const money = (value: string | null) =>
  value === null ? "unknown" : formatInr(value);
const qty = (h: Holding) =>
  `${formatQty(h.quantity)} ${h.asset_class === "stock" ? "shares" : "units"}`;
const decimalKey = (value: string | null) =>
  value === null
    ? null
    : value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
export function describeChange(change: PortfolioChange): string[] {
  if (change.detail.market_split) return ["Separated into stock and crypto portfolios; holdings preserved, no trades."];
  if (["coverage", "cash_adjustment"].includes(change.change_type)) return [];
  const before = change.detail.before as Portfolio | null | undefined;
  const after = change.detail.after as Portfolio | undefined;
  if (!after || !Array.isArray(after.holdings)) {
    if (change.change_type === "opening") return ["Portfolio created"];
    if (change.detail.symbol)
      return [
        `${change.detail.removed ? "Removed" : "Updated"} ${String(change.detail.symbol)}`,
      ];
    return ["Portfolio updated"];
  }
  const lines: string[] = [];
  if (!before) lines.push(`Created “${after.name}”`);
  else if (before.name !== after.name)
    lines.push(`Renamed “${before.name}” → “${after.name}”`);
  const old = new Map((before?.holdings ?? []).map((h) => [h.symbol, h]));
  for (const h of after.holdings) {
    const prior = old.get(h.symbol);
    if (!prior) lines.push(`Added ${h.symbol} · ${qty(h)}`);
    else {
      if (decimalKey(prior.quantity) !== decimalKey(h.quantity))
        lines.push(`${h.symbol} · ${qty(prior)} → ${qty(h)}`);
      if (decimalKey(prior.avg_cost_inr) !== decimalKey(h.avg_cost_inr))
        lines.push(
          `${h.symbol} average cost ${money(prior.avg_cost_inr)} → ${money(h.avg_cost_inr)}`,
        );
    }
    old.delete(h.symbol);
  }
  for (const h of old.values()) lines.push(`Removed ${h.symbol} · ${qty(h)}`);
  return lines.length ? lines : [];
}
