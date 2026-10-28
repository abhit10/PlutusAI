import { useEffect, useState } from "react"
import type { Asset, AssetClass, MarketHistory, MarketQuote, MarketRange } from "../lib/types"
import { portfolioApi } from "../lib/portfolio"
import { formatDateTime } from "../lib/format"
import { useMarketData } from "../lib/useMarketData"
import MarketChart, { marketPrice } from "./MarketChart"
import "./market-chart.css"

const ranges: MarketRange[] = ["1D", "1W", "1M", "1Y", "ALL"]

export default function MarketOverview({ market }: { market: AssetClass }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [selected, setSelected] = useState("")
  const [search, setSearch] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    portfolioApi.listAssets(market).then(response => {
      if (!active) return
      setAssets(response.results)
      setSelected(previous => response.results.some(asset => asset.symbol === previous) ? previous : response.results[0]?.symbol ?? "")
    }).catch(error => { if (active) setError(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [market, attempt])
  const matches = assets.filter(asset => `${asset.symbol} ${asset.name}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="dash-card market-overview" aria-label="Market explorer">
    <div className="market-toolbar">
      <div><p className="eyebrow">MARKET EXPLORER</p><h2>{market === "stock" ? "Explore NSE stocks" : "Explore crypto"}</h2></div>
      <div className="market-asset-controls">
        <label>Search assets<input type="search" placeholder="Symbol or name" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label>Chart asset<select value={selected} disabled={!assets.length || loading} onChange={event => setSelected(event.target.value)}>
          {!assets.length && <option value="">No assets</option>}
          {!matches.some(asset => asset.symbol === selected) && selected && <option value={selected}>{selected} (selected)</option>}
          {matches.map(asset => <option key={asset.id} value={asset.symbol}>{asset.symbol} · {asset.name}</option>)}
        </select></label>
      </div>
    </div>
    {search && !matches.length && <p role="status" className="market-note">No assets match your search.</p>}
    {loading ? <p role="status" className="market-loading">Loading supported assets…</p> : error ?
      <div className="market-message" role="alert">{error} <button onClick={() => setAttempt(n => n + 1)}>Retry assets</button></div> :
      selected ? <MarketData key={`${market}:${selected}`} market={market} symbol={selected} /> :
      <p className="market-note">No supported assets are available yet. Ask the project maintainer to seed the asset list.</p>}
  </section>
}

function MarketData({ symbol, market }: { symbol: string; market: AssetClass }) {
  const [range, setRange] = useState<MarketRange>("1M")
  const [mode, setMode] = useState<"candles" | "line">("candles")
  const params = `symbol=${encodeURIComponent(symbol)}&market=${market}`
  const quote = useMarketData<MarketQuote>(`/market/quote/?${params}`, 20_000)
  const history = useMarketData<MarketHistory>(`/market/history/?${params}&range=${range}`, 300_000)
  const q = quote.data
  const h = history.data
  const changeClass = q?.change == null ? "" : q.change > 0 ? "market-up" : q.change < 0 ? "market-down" : ""
  return <>
    <div className="market-quote">
      <div>
        <h3>{symbol} <span>{q?.name}</span></h3>
        <div className="market-price-row"><strong className="market-price">{q ? marketPrice(q.current_price) : "—"}</strong>
          {q && <span className={`market-change ${changeClass}`}>
            {q.change != null && q.change > 0 ? "+" : ""}{marketPrice(q.change)}
            {q.change_percent != null && ` (${q.change_percent > 0 ? "+" : ""}${q.change_percent.toFixed(2)}%)`}
          </span>}
        </div>
        {q && <p className="market-note">{q.change_basis}</p>}
      </div>
      <div className="market-status">
        <span className={`market-status-pill ${q?.stale || quote.error ? "is-stale" : ""}`}>{q?.stale || quote.error ? "Refresh unavailable" : quote.loading ? "Updating quote…" : "Polls every 20 seconds"}</span>
        {q && <><span>{q.source === "yahoo" ? "Yahoo Finance" : "Binance"} · {q.delay}</span><span>Quote as of {formatDateTime(q.timestamp)} IST</span></>}
      </div>
    </div>
    {(quote.error || q?.warning) && <p role="status" className="market-message">{quote.error || q?.warning} {q && "Last available quote remains visible."} <button onClick={quote.retry} disabled={quote.loading}>Retry quote</button></p>}
    {q?.conversion && <p className="market-note">Indicative INR at {q.conversion.rate.toFixed(4)} INR / USDT, FX as of {formatDateTime(q.conversion.timestamp)} IST. Chart prices remain in their labelled currency.</p>}
    {q && <dl className="market-stats">
      <div><dt>Open</dt><dd>{marketPrice(q.open)}</dd></div><div><dt>High</dt><dd>{marketPrice(q.day_high)}</dd></div>
      <div><dt>Low</dt><dd>{marketPrice(q.day_low)}</dd></div><div><dt>{q.source === "binance" ? "24h opening price" : "Previous close"}</dt><dd>{marketPrice(q.previous_close)}</dd></div>
    </dl>}
    <div className="market-chart-controls">
      <div className="market-segment" role="group" aria-label="Chart timeframe">{ranges.map(value => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</button>)}</div>
      <div className="market-segment" role="group" aria-label="Chart type"><button aria-pressed={mode === "candles"} onClick={() => setMode("candles")}>Candlestick</button><button aria-pressed={mode === "line"} onClick={() => setMode("line")}>Line</button></div>
    </div>
    {(history.error || h?.warning || h?.stale) && <p role="status" className="market-message">{history.error || h?.warning || "Showing cached history while the provider is unavailable."} <button onClick={history.retry} disabled={history.loading}>Retry chart</button></p>}
    {h?.candles.length ? <>
      <p className="market-chart-caption"><strong>{symbol} / {h.currency}</strong> · {h.source === "binance" ? "Binance" : "Yahoo Finance"} · {h.interval} bars · {h.period_description} · Times in IST</p>
      <MarketChart history={h} mode={mode} />
      <p className="market-note">{h.source === "yahoo" ? "Yahoo OHLC (auto-adjust off)" : "Exchange OHLC"} · Volume: {h.volume_unit.replaceAll("_", " ")} · History fetched {formatDateTime(h.fetched_at)} IST. Refreshes every 5 minutes.
        {h.truncated ? " Provider limit reached; this is a partial history." : ""}
        {h.dropped_candles > 0 ? ` ${h.dropped_candles} invalid bars omitted.` : ""}</p>
    </> : history.loading ? <div className="market-loading" role="status">Loading price history…</div> :
      <div className="market-loading">Price history is unavailable. Your holdings remain available below.</div>}
    <p className="market-note market-footer">Quotes may be delayed. Outside trading hours, NSE shows the last available session. Charts by <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™</a>.</p>
  </>
}
