"""Provider contracts are mocked; CI does not depend on external quote services."""
import time
from unittest.mock import Mock, patch

import pandas as pd
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from .models import Asset
from .services import market_data as md


class NormalizationTests(SimpleTestCase):
    def test_utc_sorted_deduplicated_and_invalid_bars_omitted(self):
        candles, dropped = md.normalize_candles([
            (1700000300, 10, 14, 9, 12, 100),
            (1700000000, 10, 14, 9, 11, 80),
            (1700000300, 10, 14, 9, 13, 110),
            (1700000600, 10, 8, 9, 12, 100),
            (1700000600, 10, 14, 9, float("nan"), 100),
            (1700000600, 10, 14, 9, 12, -1),
        ], 300)
        self.assertEqual([c["time"] for c in candles], [1700000000, 1700000300])
        self.assertEqual(candles[-1]["close"], 13)
        self.assertEqual(dropped, 3)
        self.assertTrue(candles[0]["complete"])

    def test_in_progress_candles_are_not_training_ready(self):
        candles, _ = md.normalize_candles([(int(time.time()) - 10, 1, 2, 1, 2, 0)], 300)
        self.assertFalse(candles[0]["complete"])

    def test_no_valid_candles_is_an_error(self):
        with self.assertRaises(md.MarketUnavailable):
            md.normalize_candles([(1, 0, 0, 0, 0, 0)], 300)

    def test_provider_symbols(self):
        self.assertEqual(md.yahoo_symbol("TCS", "stock"), "TCS.NS")
        self.assertEqual(md.yahoo_symbol("TCS.NS", "stock"), "TCS.NS")
        self.assertEqual(md.yahoo_symbol("BTC", "crypto"), "BTC-INR")

    def test_yahoo_timestamp_versions_and_timezone(self):
        stamp = pd.Timestamp("2026-01-05 09:15", tz="Asia/Kolkata")
        self.assertEqual(md.epoch(stamp), stamp.timestamp())
        self.assertEqual(md.epoch(stamp.timestamp()), stamp.timestamp())
        with self.assertRaises(ValueError):
            md.epoch(pd.Timestamp("2026-01-05 09:15"))


class CacheTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    def test_hot_cache_does_not_refetch(self):
        loader = Mock(return_value={"current_price": 100})
        md.cached("test", 20, 60, loader)
        result = md.cached("test", 20, 60, loader)
        loader.assert_called_once()
        self.assertTrue(result["cached"])
        self.assertFalse(result["stale"])

    def test_provider_error_returns_marked_stale_with_original_timestamp(self):
        first = md.cached("test", 20, 60, lambda: {"current_price": 100, "timestamp": "2026-01-01T00:00:00Z"})
        cache.delete("market:v1:test")
        loader = Mock(side_effect=TimeoutError)
        result = md.cached("test", 20, 60, loader)
        self.assertTrue(result["stale"])
        self.assertEqual(result["timestamp"], first["timestamp"])
        self.assertEqual(result["fetched_at"], first["fetched_at"])
        md.cached("test", 20, 60, loader)
        loader.assert_called_once()  # failed refresh backoff

    def test_failure_without_cache_does_not_invent_prices(self):
        with self.assertRaises(md.MarketUnavailable):
            md.cached("empty", 20, 60, Mock(side_effect=TimeoutError))

    @patch.object(md.time, "sleep")
    def test_concurrent_miss_does_not_duplicate_provider_work(self, sleep):
        cache.set("market:v1:busy:lock", True)
        loader = Mock()
        with self.assertRaises(md.MarketUnavailable):
            md.cached("busy", 20, 60, loader)
        loader.assert_not_called()

    @patch.object(md.time, "sleep")
    def test_concurrent_request_reuses_result_when_ready(self, sleep):
        cache.set("market:v1:busy:lock", True)
        sleep.side_effect = lambda _: cache.set("market:v1:busy", {"current_price": 123, "stale": False})
        loader = Mock()
        result = md.cached("busy", 20, 60, loader)
        self.assertEqual(result["current_price"], 123)
        self.assertTrue(result["cached"])
        loader.assert_not_called()


class AdapterTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def tearDown(self):
        cache.clear()

    @patch.object(md, "yahoo_history")
    @patch.object(md, "binance")
    def test_binance_history_is_native_usdt_not_relabelled_inr(self, fetch, fallback):
        fetch.return_value = [[1700000000000, "10", "14", "9", "12", "20", 0]]
        result = md.crypto_history("BTC", "1M")
        self.assertEqual(result["currency"], "USDT")
        self.assertEqual(result["candles"][0]["close"], 12)
        self.assertEqual(result["volume_unit"], "BTC")
        fallback.assert_not_called()

    @patch.object(md, "yahoo_history", return_value={"currency": "INR", "source": "yahoo"})
    @patch.object(md, "binance", side_effect=TimeoutError)
    def test_binance_outage_uses_explicit_inr_fallback(self, fetch, fallback):
        result = md.crypto_history("ETH", "1W")
        self.assertEqual(result["currency"], "INR")
        self.assertIn("Currency and source have changed", result["warning"])
        fallback.assert_called_once_with("ETH", "crypto", "1W")

    @patch.object(md, "yahoo_quote")
    @patch.object(md, "binance")
    def test_binance_quote_uses_usdt_inr_rate_and_metadata(self, fetch, yahoo):
        fetch.return_value = dict(symbol="BTCUSDT", lastPrice="100", openPrice="80", highPrice="110", lowPrice="70", volume="5", closeTime=int(time.time() * 1000))
        yahoo.return_value = {"current_price": 90, "timestamp": md.iso(time.time())}
        quote = md.crypto_quote("BTC")
        self.assertEqual(quote["current_price"], 9000)
        self.assertEqual(quote["change_percent"], 25)
        self.assertEqual(quote["change"], 1800)
        self.assertEqual(quote["conversion"]["pair"], "USDT-INR")
        self.assertEqual(quote["volume"], 5)

    @patch.object(md, "yahoo_quote")
    @patch.object(md, "binance")
    def test_old_fx_cannot_be_silently_used(self, fetch, yahoo):
        fetch.return_value = {"symbol": "BTCUSDT"}
        yahoo.side_effect = [{"current_price": 90, "timestamp": md.iso(time.time() - 172800)}, {"currency": "INR", "source": "yahoo"}]
        quote = md.crypto_quote("BTC")
        self.assertEqual(quote["source"], "yahoo")
        self.assertIn("fallback", quote["warning"])

    @patch.object(md.yf, "Ticker")
    def test_yahoo_intraday_uses_last_trading_day_and_utc(self, ticker):
        frame = pd.DataFrame(dict(Open=[10, 11, 12], High=[12, 13, 14], Low=[9, 10, 11], Close=[11, 12, 13], Volume=[3, 4, 5]),
                             index=pd.DatetimeIndex(["2026-01-02 15:25", "2026-01-05 09:15", "2026-01-05 09:20"], tz="Asia/Kolkata"))
        ticker.return_value.history.return_value = frame
        ticker.return_value.get_history_metadata.return_value = {"currency": "INR"}
        result = md.yahoo_history("TCS", "stock", "1D")
        self.assertEqual(len(result["candles"]), 2)
        self.assertEqual(result["candles"][0]["time"], int(frame.index[1].timestamp()))
        self.assertFalse(ticker.return_value.history.call_args.kwargs["auto_adjust"])

    @patch.object(md.yf, "Ticker")
    def test_yahoo_quote_uses_provider_timestamp_and_previous_session(self, ticker):
        ticker.return_value.history.return_value = pd.DataFrame(dict(Open=[90, 95], High=[100, 110], Low=[80, 90], Close=[95, 105], Volume=[50, 60]))
        stamp = time.time() - 60
        ticker.return_value.get_history_metadata.return_value = {"currency": "INR", "regularMarketPrice": 105, "regularMarketTime": stamp, "chartPreviousClose": 80}
        quote = md.yahoo_quote("TCS", "stock")
        self.assertEqual(quote["previous_close"], 95)
        self.assertEqual(quote["change"], 10)
        self.assertEqual(quote["timestamp"], md.iso(stamp))


class MarketEndpointTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(username="market-reader")
        self.asset = Asset.objects.create(symbol="TCS", name="Tata Consultancy Services", asset_class="stock")
        self.client.force_authenticate(self.user)

    def tearDown(self):
        cache.clear()

    @patch.object(md, "quote")
    def test_authentication_required(self, loader):
        self.client.force_authenticate(None)
        response = self.client.get("/api/market/quote/?symbol=TCS&market=stock")
        self.assertEqual(response.status_code, 403)
        loader.assert_not_called()

    @patch.object(md, "quote", return_value={"current_price": 100, "currency": "INR"})
    def test_normalized_nse_suffix(self, loader):
        response = self.client.get("/api/market/quote/?symbol=tcs.ns&market=stock")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(loader.call_args.args[0].symbol, "TCS")
        self.assertIn("no-store", response["Cache-Control"])

    @patch.object(md, "quote")
    @patch.object(md, "history")
    def test_invalid_unknown_and_wrong_market_never_fetch(self, history, quote):
        for query, code in [("symbol=TCS&market=bad", 400), ("symbol=https://example.com&market=stock", 400), ("symbol=UNKNOWN&market=stock", 404), ("symbol=TCS&market=crypto", 404)]:
            with self.subTest(query=query):
                self.assertEqual(self.client.get("/api/market/quote/?" + query).status_code, code)
        self.assertEqual(self.client.get("/api/market/history/?symbol=TCS&market=stock&range=5Y").status_code, 400)
        quote.assert_not_called()
        history.assert_not_called()

    @patch.object(md, "quote", side_effect=md.MarketUnavailable("Please retry shortly."))
    def test_outage_returns_retryable_503(self, quote):
        response = self.client.get("/api/market/quote/?symbol=TCS&market=stock")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response["Retry-After"], "20")
        self.assertNotIn("current_price", response.data)

    @patch.object(md, "yahoo_history")
    def test_history_cache_is_separate_for_each_range(self, loader):
        loader.return_value = {"candles": [], "currency": "INR"}
        for range_name in ("1D", "1M", "1D"):
            response = self.client.get(f"/api/market/history/?symbol=TCS&market=stock&range={range_name}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["range"], range_name)
        self.assertEqual(loader.call_count, 2)

    @patch.object(md, "quote")
    def test_inactive_asset_is_not_fetched(self, loader):
        self.asset.active = False
        self.asset.save()
        self.assertEqual(self.client.get("/api/market/quote/?symbol=TCS&market=stock").status_code, 404)
        loader.assert_not_called()
