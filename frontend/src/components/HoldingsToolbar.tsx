import { useState } from "react";
import type { Holding } from "../lib/types";
import { decimalUnits } from "../lib/quantity";
import { Input } from "./ui";
export function useHoldingFilters(holdings: Holding[]) {
  const [search, setSearch] = useState(""),
    [sort, setSort] = useState("name");
  const rows = holdings
    .filter(
      (h) =>
        `${h.symbol} ${h.asset_name}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === "quantity") {
        const x = decimalUnits(a.quantity) || 0n,
          y = decimalUnits(b.quantity) || 0n;
        if (x !== y) return x > y ? -1 : 1;
      }
      return (
        a.asset_name.localeCompare(b.asset_name) ||
        a.symbol.localeCompare(b.symbol)
      );
    });
  return {
    rows,
    search,
    setSearch,
    sort,
    setSort,
    reset: () => {
      setSearch("");
    },
  };
}
export default function HoldingsToolbar({
  filter,
}: {
  filter: ReturnType<typeof useHoldingFilters>;
}) {
  return (
    <div className="holdings-toolbar">
      <Input
        aria-label="Search holdings"
        placeholder="Search symbol or name"
        value={filter.search}
        onChange={(e) => filter.setSearch(e.target.value)}
      />
      <label className="sort-label">
        Sort
        <select
          value={filter.sort}
          onChange={(e) => filter.setSort(e.target.value)}
        >
          <option value="name">Name</option>
          <option value="quantity">Quantity · highest first</option>
        </select>
      </label>
    </div>
  );
}
