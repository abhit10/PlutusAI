import type { MarketQuote, Portfolio } from '../lib/types';
import { useMarketData } from '../lib/useMarketData';
import { formatDateTime, formatInr } from '../lib/format';
import { Button } from './ui';

export interface PricedHolding {
  symbol: string; quote: MarketQuote | null; value_inr: string | null;
  gain_inr: string | null; error: string | null;
}
interface Valuation {
  version: number; holdings: PricedHolding[]; complete: boolean; cost_complete: boolean;
  stale: boolean; value_inr: string | null; gain_inr: string | null;
}
export function signedMoney(value: string) {
  return value.startsWith('-') ? `−${formatInr(value.slice(1))}` : formatInr(value);
}
export function usePortfolioPrices(p: Portfolio) {
  const resource = useMarketData<Valuation>(p.holdings.length
    ? `/market/portfolio/${p.id}/?version=${p.version}` : null, 20_000);
  // Never combine an old quantity snapshot with new saved holdings.
  const data = resource.data?.version === p.version ? resource.data : undefined;
  return { ...resource, data };
}
export function PortfolioPriceSummary({ prices }: { prices: ReturnType<typeof usePortfolioPrices> }) {
  const { data, error, loading, retry } = prices;
  return <section className="live-valuation" aria-label="Live portfolio value">
    <div className="live-price-grid">
      <div><small>Holdings market value</small><strong>{data?.value_inr != null ? formatInr(data.value_inr) : '—'}</strong></div>
      <div><small>Unrealized gain / loss</small><strong>{data?.gain_inr != null ? signedMoney(data.gain_inr) : '—'}</strong></div>
      <Button variant="outline" disabled={loading} onClick={retry}>{loading ? 'Refreshing prices…' : 'Refresh prices'}</Button>
    </div>
    <p className="muted">{error ? `Prices could not refresh: ${error}` : data?.stale ? 'Some prices are stale.' : 'Prices refresh every 20 seconds while this tab is visible.'}
      {' '}Quotes may be delayed; closed markets use the last session. Crypto INR values are indicative. Cash is excluded.</p>
    {data && !data.complete && <p className="muted">Total unavailable: one or more holdings have no quote.</p>}
    {data && !data.cost_complete && <p className="muted">Total gain/loss is unavailable until every purchase cost is known.</p>}
    {!data && !loading && !error && <p className="muted">Portfolio changed. Reload the portfolio to see its latest holdings.</p>}
  </section>;
}
export function HoldingPrices({ row, stale = false }: { row?: PricedHolding; stale?: boolean }) {
  return <div className="holding-live-prices">
    <div className="live-price-grid">
      <div><small>Market price / unit</small><strong>{row?.quote ? formatInr(row.quote.current_price.toFixed(2)) : '—'}</strong></div>
      <div><small>Market value</small><strong>{row?.value_inr != null ? formatInr(row.value_inr) : '—'}</strong></div>
      <div><small>Unrealized gain / loss</small><strong>{row?.gain_inr != null ? signedMoney(row.gain_inr) : '—'}</strong></div>
    </div>
    <small className="muted">{row?.quote
      ? `${stale || row.quote.stale ? 'Stale · ' : ''}${row.quote.source === 'binance' ? 'Binance · Indicative INR' : 'Yahoo Finance'} · As of ${formatDateTime(row.quote.timestamp)} IST`
      : row?.error || 'Waiting for a market quote…'}</small>
  </div>;
}
