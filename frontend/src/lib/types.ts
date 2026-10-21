export interface User {
  id: number
  email: string
  name: string
}

export type AssetClass = "stock" | "crypto"

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
