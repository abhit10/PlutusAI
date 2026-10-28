"""Provider adapters producing UTC OHLCV, with provenance and bounded caching.

Prices here are display/analytics floats; they never enter the Decimal ledger.
Binance candles remain in USDT. Converting past OHLC with current FX would
misrepresent history. Yahoo fallback candles are independently sourced in INR.
"""
import logging
import math
import time
from datetime import datetime, timedelta, timezone

import requests
import yfinance as yf
from django.core.cache import cache

logger = logging.getLogger(__name__)
BINANCE_URL = "https://data-api.binance.vision/api/v3"
RANGES = {
    "1D": (1, "5m", "5m", 300),
    "1W": (7, "30m", "30m", 1800),
    "1M": (30, "60m", "1h", 3600),
    "1Y": (365, "1d", "1d", 86400),
    "ALL": (None, "1wk", "1w", 604800),
}


class MarketUnavailable(Exception):
    """No safe data is available; API should return a retryable 503."""


def iso(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")


def epoch(value):
    # yfinance 1.x returns timezone-aware pandas Timestamps; older releases
    # returned epoch seconds. Never interpret an unzoned wall clock as UTC.
    if isinstance(value, datetime):
        if value.tzinfo is None:
            raise ValueError("Provider timestamp has no timezone")
        value = value.timestamp()
    return number(value, positive=True)


def number(value, *, positive=False):
    result = float(value)
    if not math.isfinite(result) or (positive and result <= 0):
        raise ValueError("Invalid provider number")
    return result


def normalize_candles(rows, interval_seconds):
    """Reject invalid bars, deduplicate and sort. Never fill missing prices.

    Input: (UTC epoch seconds, open, high, low, close, base-unit volume).
    Incomplete bars are explicitly marked so future training can exclude them.
    """
    result, dropped = {}, 0
    now = time.time()
    for row in rows:
        try:
            stamp = int(row[0])
            o, h, lo, c = [number(v, positive=True) for v in row[1:5]]
            volume = number(row[5])
            if stamp <= 0 or stamp > now + 60 or volume < 0 or not lo <= min(o, c) <= max(o, c) <= h:
                raise ValueError("Invalid provider candle")
            result[stamp] = dict(time=stamp, open=o, high=h, low=lo, close=c,
                                 volume=volume, complete=stamp + interval_seconds <= now)
        except (ValueError, TypeError, IndexError, OverflowError):
            dropped += 1
    if not result:
        raise MarketUnavailable("No valid market candles available.")
    return [result[t] for t in sorted(result)], dropped


def cached(key, ttl, stale_ttl, loader):
    """Hot cache + marked last-known-good data, brief failure backoff and a lock.

    Django's default cache is process-local. Use a shared cache in multiworker
    deployments. A cold request incurs provider latency; only hits are fast.
    """
    key = f"market:v1:{key}"
    hit = cache.get(key)
    if hit is not None:
        return {**hit, "cached": True}
    stale = cache.get(key + ":stale")

    def unavailable():
        if stale is not None:
            return {**stale, "stale": True, "cached": True,
                    "warning": "Refresh unavailable; showing last successful data."}
        raise MarketUnavailable("Market provider unavailable or busy. Please retry shortly.")

    if cache.get(key + ":failed"):
        return unavailable()
    if not cache.add(key + ":lock", True, 45):
        # Another request (including a React development remount) is warming
        # this key. Reuse its result instead of immediately reporting an outage.
        if stale is not None:
            return unavailable()
        for _ in range(30):
            time.sleep(0.05)
            hit = cache.get(key)
            if hit is not None:
                return {**hit, "cached": True}
            if cache.get(key + ":failed"):
                break
        return unavailable()
    try:
        payload = {**loader(), "fetched_at": iso(time.time()), "stale": False, "cached": False}
        cache.set(key, payload, ttl)
        cache.set(key + ":stale", payload, stale_ttl)
        return payload
    except Exception as exc:
        # Provider messages can contain URLs/credentials. Log type only.
        logger.warning("Market adapter failed: %s", type(exc).__name__)
        cache.set(key + ":failed", True, 20)
        return unavailable()
    finally:
        cache.delete(key + ":lock")


def yahoo_symbol(symbol, market):
    if market == "stock":
        return symbol if symbol.endswith(".NS") else symbol + ".NS"
    return symbol + "-INR"


def yahoo_frame(ticker, **kwargs):
    frame = ticker.history(auto_adjust=False, actions=False, timeout=6,
                           raise_errors=True, **kwargs)
    if frame is None or frame.empty:
        raise MarketUnavailable("No Yahoo data available.")
    return frame


def yahoo_quote(symbol, market, provider_symbol=None):
    provider_symbol = provider_symbol or yahoo_symbol(symbol, market)
    ticker = yf.Ticker(provider_symbol)
    frame = yahoo_frame(ticker, period="5d", interval="1d")
    metadata = ticker.get_history_metadata()
    if metadata.get("currency") != "INR":
        raise MarketUnavailable("Unexpected Yahoo quote currency.")
    stamp = epoch(metadata.get("regularMarketTime"))
    if stamp > time.time() + 60:
        raise MarketUnavailable("Invalid provider timestamp.")
    current = number(metadata.get("regularMarketPrice"), positive=True)
    # Daily rows align to the exchange calendar. Previous day's close is the
    # comparison, not Yahoo's chartPreviousClose (start of the entire window).
    previous = number(frame.iloc[-2]["Close"], positive=True) if len(frame) > 1 else None
    last = frame.iloc[-1]
    change = current - previous if previous is not None else None
    return dict(current_price=current, previous_close=previous, change=change,
                change_percent=100 * change / previous if previous else None,
                day_high=number(last["High"], positive=True),
                day_low=number(last["Low"], positive=True),
                open=number(last["Open"], positive=True), volume=max(0, number(last["Volume"])),
                timestamp=iso(stamp), currency="INR", source="yahoo",
                provider_symbol=provider_symbol, delay="May be delayed; last available quote",
                change_basis="Since previous daily close", conversion=None)


def binance(path, **params):
    response = requests.get(f"{BINANCE_URL}/{path}", params=params, timeout=(3, 6))
    response.raise_for_status()
    return response.json()


def crypto_quote(symbol):
    try:
        row = binance("ticker/24hr", symbol=symbol + "USDT")
        if row["symbol"] != symbol + "USDT":
            raise ValueError("Unexpected trading pair")
        fx = cached("usdt-inr", 300, 300, lambda: yahoo_quote("USDT", "crypto"))
        if fx["stale"] or time.time() - datetime.fromisoformat(fx["timestamp"]).timestamp() > 86400:
            raise MarketUnavailable("INR conversion is unavailable.")
        rate = number(fx["current_price"], positive=True)
        current = number(row["lastPrice"], positive=True)
        previous = number(row["openPrice"], positive=True)
        stamp = number(row["closeTime"], positive=True) / 1000
        if abs(time.time() - stamp) > 300:
            raise MarketUnavailable("Binance quote is outdated.")
        return dict(current_price=current * rate, previous_close=previous * rate,
                    change=(current - previous) * rate,
                    change_percent=(current - previous) / previous * 100,
                    day_high=number(row["highPrice"], positive=True) * rate,
                    day_low=number(row["lowPrice"], positive=True) * rate,
                    open=previous * rate, volume=max(0, number(row["volume"])),
                    timestamp=iso(stamp), currency="INR", source="binance",
                    provider_symbol=symbol + "USDT", delay="Indicative INR conversion",
                    change_basis="Rolling 24h in USDT; INR amounts use the latest conversion",
                    conversion=dict(pair="USDT-INR", rate=rate, source="yahoo", timestamp=fx["timestamp"]))
    except Exception:
        return {**yahoo_quote(symbol, "crypto"), "warning": "Binance or INR conversion unavailable; using Yahoo INR fallback."}


def quote(asset):
    payload = cached(f"quote:{asset.asset_class}:{asset.symbol}", 20, 900,
                     lambda: crypto_quote(asset.symbol) if asset.asset_class == "crypto"
                     else yahoo_quote(asset.symbol, "stock"))
    return {**payload, "symbol": asset.symbol, "name": asset.name, "market": asset.asset_class}


def yahoo_history(symbol, market, range_name):
    days, interval, _, seconds = RANGES[range_name]
    ticker = yf.Ticker(yahoo_symbol(symbol, market))
    now = datetime.now(timezone.utc)
    if range_name == "ALL":
        args = dict(period="max")
    elif range_name == "1D" and market == "stock":
        args = dict(period="5d")  # last trading session, including weekends
    else:
        args = dict(start=now - timedelta(days=days), end=now)
    frame = yahoo_frame(ticker, interval=interval, **args)
    if ticker.get_history_metadata().get("currency") != "INR":
        raise MarketUnavailable("Unexpected Yahoo history currency.")
    if frame.index.tz is None:
        raise MarketUnavailable("Provider omitted exchange timezone.")
    if range_name == "1D" and market == "stock":
        frame = frame[frame.index.date == frame.index[-1].date()]
    rows = [(int(index.timestamp()), row["Open"], row["High"], row["Low"], row["Close"], row["Volume"])
            for index, row in frame.iterrows()]
    candles, dropped = normalize_candles(rows, seconds)
    return dict(candles=candles, currency="INR", source="yahoo", interval=interval,
                provider_symbol=yahoo_symbol(symbol, market), dropped_candles=dropped,
                truncated=False, price_basis="yahoo_auto_adjust_false", volume_unit="shares" if market == "stock" else "provider_reported")


def crypto_history(symbol, range_name):
    try:
        days, _, interval, seconds = RANGES[range_name]
        start = int((time.time() - days * 86400) * 1000) if days else 0
        rows = binance("klines", symbol=symbol + "USDT", interval=interval, startTime=start, limit=1000)
        if not isinstance(rows, list):
            raise ValueError("Unexpected Binance history response")
        candles, dropped = normalize_candles(
            [(int(r[0]) // 1000, *r[1:6]) for r in rows], seconds)
        return dict(candles=candles, currency="USDT", source="binance", interval=interval,
                    provider_symbol=symbol + "USDT", dropped_candles=dropped,
                    truncated=len(rows) == 1000, price_basis="exchange_native", volume_unit=symbol)
    except Exception:
        return {**yahoo_history(symbol, "crypto", range_name),
                "warning": "Binance unavailable; using Yahoo history in INR. Currency and source have changed."}


def history(asset, range_name):
    payload = cached(f"history:{asset.asset_class}:{asset.symbol}:{range_name}", 300, 86400,
                     lambda: crypto_history(asset.symbol, range_name) if asset.asset_class == "crypto"
                     else yahoo_history(asset.symbol, "stock", range_name))
    return {**payload, "symbol": asset.symbol, "market": asset.asset_class,
            "range": range_name, "timezone": "UTC", "schema_version": 1,
            "period_description": "Last trading session" if range_name == "1D" and asset.asset_class == "stock"
            else "All available weekly bars" if range_name == "ALL" else range_name}
