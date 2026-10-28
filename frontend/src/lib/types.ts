export interface User {
  id: number
  email: string
  name: string
}

export type AssetClass = "stock" | "crypto"

export type MarketRange = "1D" | "1W" | "1M" | "1Y" | "ALL"
export type MarketCurrency = "INR" | "USDT"
export interface MarketProvenance {
  symbol: string
  market: AssetClass
  source: "yahoo" | "binance"
  provider_symbol: string
  currency: MarketCurrency
  fetched_at: string
  cached: boolean
  stale: boolean
  warning?: string
}
export interface MarketQuote extends MarketProvenance {
  name: string
  current_price: number
  change: number | null
  change_percent: number | null
  day_high: number
  day_low: number
  open: number
  previous_close: number | null
  volume: number
  timestamp: string
  delay: string
  change_basis: string
  conversion: { pair: string; rate: number; source: string; timestamp: string } | null
}
export interface MarketCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  complete: boolean
}
export interface MarketHistory extends MarketProvenance {
  range: MarketRange
  candles: MarketCandle[]
  interval: string
  timezone: "UTC"
  schema_version: number
  price_basis: "yahoo_auto_adjust_false" | "exchange_native"
  volume_unit: string
  dropped_candles: number
  truncated: boolean
  period_description: string
}

export interface Asset {
  id: number
  symbol: string
  name: string
  asset_class: AssetClass
  sector: string
  currency: string
  quantity_step: string
  active: boolean
}

export interface Holding {
  id: number
  asset: number
  symbol: string
  asset_name: string
  asset_class: AssetClass
  quantity_step: string
  entered_cost_inr: string | null
  quantity: string
  avg_cost_inr: string | null
  updated_at: string
}

export type PortfolioKind = "mirror" | "scenario" | "sample"

export interface Portfolio {
  asset_class: AssetClass
  id: number
  name: string
  kind: PortfolioKind
  parent: number | null
  version: number
  cash_inr: string
  cash_confirmed: boolean
  coverage_complete: boolean
  coverage_note: string
  last_confirmed_at: string | null
  holdings: Holding[]
  created_at: string
  updated_at: string
}

export interface PortfolioChange {
  id: number
  change_type: string
  old_version: number
  new_version: number
  detail: Record<string, unknown>
  reason: string
  created_at: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
