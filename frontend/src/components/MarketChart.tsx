import { useEffect, useRef, useState } from "react"
import { AreaSeries, CandlestickSeries, ColorType, createChart, HistogramSeries, TickMarkType } from "lightweight-charts"
import type { IChartApi, ISeriesApi, Time, UTCTimestamp } from "lightweight-charts"
import type { MarketCandle, MarketCurrency, MarketHistory } from "../lib/types"
import { formatInr } from "../lib/format"

export function marketPrice(value: number | null | undefined, currency: MarketCurrency = "INR") {
  if (value == null || !Number.isFinite(value)) return "—"
  if (currency === "INR") return `${value < 0 ? "−" : ""}${formatInr(Math.abs(value).toFixed(2))}`
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} USDT`
}
export function candleDate(time: number) {
  return new Date(time * 1000).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  })
}

export default function MarketChart({ history, mode }: { history: MarketHistory; mode: "candles" | "line" }) {
  const container = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const series = useRef<{ candles: ISeriesApi<"Candlestick">; area: ISeriesApi<"Area">; volume: ISeriesApi<"Histogram"> } | null>(null)
  const rowsRef = useRef(new Map<number, MarketCandle>())
  const identityRef = useRef("")
  const [hovered, setHovered] = useState<MarketCandle | null>(null)

  useEffect(() => {
    if (!container.current) return
    const chart = createChart(container.current, {
      height: 370, autoSize: true,
      layout: { attributionLogo: true, fontFamily: "Inter, system-ui, sans-serif" },
      timeScale: { timeVisible: true, secondsVisible: false, borderVisible: false,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          if (typeof time !== "number") return String(time)
          const date = new Date(time * 1000)
          const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" }
          if (type === TickMarkType.Year) options.year = "numeric"
          else if (type === TickMarkType.Month) options.month = "short"
          else if (type === TickMarkType.DayOfMonth) { options.day = "numeric"; options.month = "short" }
          else { options.hour = "2-digit"; options.minute = "2-digit"; options.hour12 = false }
          return date.toLocaleString("en-IN", options)
        },
      },
      rightPriceScale: { borderVisible: false },
      localization: { locale: "en-IN", timeFormatter: (time: Time) => typeof time === "number" ? candleDate(time) : String(time) },
      handleScroll: { vertTouchDrag: false },
    })
    chartRef.current = chart
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: "#16836a", downColor: "#d04b57", wickUpColor: "#16836a", wickDownColor: "#d04b57", borderVisible: false,
    })
    const area = chart.addSeries(AreaSeries, { lineColor: "#329b85", topColor: "#329b8538", bottomColor: "#329b8500", lineWidth: 2 })
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume" })
    chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.08, bottom: 0.25 } })
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false })
    series.current = { candles, area, volume }
    const applyTheme = () => {
      const style = getComputedStyle(document.documentElement)
      chart.applyOptions({
        layout: { background: { type: ColorType.Solid, color: style.getPropertyValue("--color-surface").trim() || "#ffffff" }, textColor: style.getPropertyValue("--color-muted").trim() || "#5F6875" },
        grid: { vertLines: { visible: false }, horzLines: { color: style.getPropertyValue("--color-border").trim() || "#DADDE2" } },
      })
    }
    applyTheme()
    const observer = new MutationObserver(applyTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    chart.subscribeCrosshairMove(event => setHovered(typeof event.time === "number" ? rowsRef.current.get(event.time) ?? null : null))
    return () => {
      observer.disconnect()
      chart.remove()
      series.current = null
      chartRef.current = null
      identityRef.current = ""
    }
  }, [])

  useEffect(() => {
    if (!series.current || !chartRef.current) return
    const { candles, area, volume } = series.current
    rowsRef.current = new Map(history.candles.map(row => [row.time, row]))
    candles.setData(history.candles.map(row => ({ ...row, time: row.time as UTCTimestamp })))
    area.setData(history.candles.map(row => ({ time: row.time as UTCTimestamp, value: row.close })))
    volume.setData(history.candles.map(row => ({ time: row.time as UTCTimestamp, value: row.volume, color: row.close >= row.open ? "#16836a55" : "#d04b5755" })))
    const key = `${history.symbol}:${history.range}:${history.source}:${history.currency}`
    if (key !== identityRef.current) {
      chartRef.current.timeScale().fitContent()
      identityRef.current = key
    }
    setHovered(null)
  }, [history])

  useEffect(() => {
    series.current?.candles.applyOptions({ visible: mode === "candles" })
    series.current?.area.applyOptions({ visible: mode === "line" })
  }, [mode])

  const current = hovered ?? history.candles.at(-1)
  return <>
    <div className="market-chart-legend" aria-live="off">
      {current && <>
        <span>{candleDate(current.time)} IST {current.complete ? "" : "· Forming bar"}</span>
        <span>O <b>{marketPrice(current.open, history.currency)}</b></span>
        <span>H <b>{marketPrice(current.high, history.currency)}</b></span>
        <span>L <b>{marketPrice(current.low, history.currency)}</b></span>
        <span>C <b>{marketPrice(current.close, history.currency)}</b></span>
        <span>Vol <b>{current.volume.toLocaleString("en-IN", { maximumFractionDigits: 4 })}</b></span>
      </>}
    </div>
    <div ref={container} className="market-canvas" role="img" aria-label={`${history.symbol} ${mode === "candles" ? "candlestick" : "line"} chart in ${history.currency} with volume. Use the candle inspector below for keyboard access.`} />
    <div className="market-inspector">
      <label>Inspect candle
        <input type="range" min={0} max={Math.max(0, history.candles.length - 1)}
          value={hovered ? history.candles.findIndex(row => row.time === hovered.time) : history.candles.length - 1}
          onChange={event => setHovered(history.candles[Number(event.target.value)])}
          aria-valuetext={current ? `${candleDate(current.time)}, close ${marketPrice(current.close, history.currency)}` : "No data"} />
      </label>
      <button type="button" onClick={() => chartRef.current?.timeScale().fitContent()}>Reset zoom</button>
    </div>
  </>
}
