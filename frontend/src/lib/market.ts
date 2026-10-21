import type { AssetClass } from "./types";
export const marketPath = (market: AssetClass) => market === "stock" ? "/stocks" : "/crypto";
export const marketLabel = (market: AssetClass) => market === "stock" ? "Stocks" : "Crypto";
export function savedMarket(): AssetClass {
  try { return localStorage.getItem("plutus-market") === "crypto" ? "crypto" : "stock"; } catch { return "stock"; }
}
export function rememberMarket(market: AssetClass) {
  try { localStorage.setItem("plutus-market", market); } catch { /* Optional preference. */ }
}
