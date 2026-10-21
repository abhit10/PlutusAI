import { api } from "./api";
import type { Asset, AssetClass, Paginated, Portfolio, PortfolioChange } from "./types";

// Follow every API page so assets, portfolios and audits are never silently hidden.
async function allPages<T>(path: string): Promise<Paginated<T>> {
  const results: T[] = [];
  let page = 1;
  while (true) {
    const response = await api.get<Paginated<T>>(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}`,
    );
    results.push(...response.results);
    if (!response.next)
      return { count: response.count, results, next: null, previous: null };
    page++;
  }
}

export const portfolioApi = {
  listAssets: (assetClass: AssetClass, search = "") =>
    allPages<Asset>(
      `/assets/?asset_class=${assetClass}&search=${encodeURIComponent(search)}`,
    ),

  list: (assetClass: AssetClass) => allPages<Portfolio>(`/portfolios/?asset_class=${assetClass}`),

  rename: (id: number, expected_version: number, name: string) =>
    api.patch<Portfolio>(`/portfolios/${id}/`, { expected_version, name }),

  get: (id: number, assetClass: AssetClass) => api.get<Portfolio>(`/portfolios/${id}/?asset_class=${assetClass}`),

  create: (
    name: string,
    asset_class: AssetClass,
    opening: {
      holdings?: {
        symbol: string;
        quantity: string;
        avg_cost_inr: string | null;
      }[];
    } = {},
  ) =>
    api.post<Portfolio>("/portfolios/", { name, asset_class, kind: "mirror", ...opening }),

  upsertHolding: (
    id: number,
    expected_version: number,
    payload: { symbol: string; quantity: string; avg_cost_inr?: string | null },
  ) =>
    api.post<Portfolio>(`/portfolios/${id}/holdings/`, {
      expected_version,
      ...payload,
    }),

  removeHolding: (id: number, expected_version: number, symbol: string) =>
    api.post<Portfolio>(`/portfolios/${id}/holdings/remove/`, {
      expected_version,
      symbol,
    }),

  delete: (id: number) => api.del<void>(`/portfolios/${id}/`),

  changes: (id: number) =>
    allPages<PortfolioChange>(`/portfolios/${id}/changes/`),
};
