from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Asset, Holding, Portfolio
from .services import market_data


class PortfolioValuationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create_user(username='valuation-owner')
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.portfolio = Portfolio.objects.create(owner=self.user, asset_class='crypto')
        self.asset = Asset.objects.create(symbol='BTC', name='Bitcoin', asset_class='crypto')
        self.holding = Holding.objects.create(portfolio=self.portfolio, asset=self.asset,
                                              quantity=Decimal('0.123456789012'), avg_cost_inr=Decimal('100.00'))
        self.url = f'/api/market/portfolio/{self.portfolio.pk}/'

    def tearDown(self):
        cache.clear()

    @patch.object(market_data, 'quote', return_value={'current_price': 123.45, 'currency': 'INR', 'stale': False})
    def test_exact_values_refresh_without_mutating_ledger(self, quote):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['value_inr'], '15.24')
        self.assertEqual(response.data['gain_inr'], '2.90')
        quote.return_value = {'current_price': 90, 'currency': 'INR', 'stale': False}
        refreshed = self.client.get(self.url).data
        self.assertEqual(refreshed['value_inr'], '11.11')
        self.assertEqual(refreshed['gain_inr'], '-1.23')
        self.holding.refresh_from_db()
        self.portfolio.refresh_from_db()
        self.assertEqual(self.holding.avg_cost_inr, Decimal('100.00'))
        self.assertEqual(self.portfolio.version, 1)
        self.assertFalse(self.portfolio.changes.exists())
        self.assertIn('no-store', response['Cache-Control'])

    @patch.object(market_data, 'quote')
    def test_other_users_and_anonymous_cannot_fetch_quotes(self, quote):
        other = get_user_model().objects.create_user(username='other')
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        quote.assert_not_called()

    @patch.object(market_data, 'quote', return_value={'current_price': 50, 'currency': 'INR', 'stale': True})
    def test_stale_and_unknown_cost_are_explicit(self, quote):
        self.holding.avg_cost_inr = None
        self.holding.save()
        data = self.client.get(self.url).data
        self.assertTrue(data['stale'])
        self.assertFalse(data['cost_complete'])
        self.assertIsNone(data['gain_inr'])
        self.assertEqual(data['value_inr'], '6.17')

    @patch.object(market_data, 'quote')
    def test_partial_outage_does_not_misrepresent_total(self, quote):
        asset = Asset.objects.create(symbol='ETH', name='Ethereum', asset_class='crypto')
        Holding.objects.create(portfolio=self.portfolio, asset=asset, quantity=1, avg_cost_inr=0)
        def load(asset):
            if asset.symbol == 'ETH':
                raise market_data.MarketUnavailable('Temporarily unavailable')
            return {'current_price': 50, 'currency': 'INR', 'stale': False}
        quote.side_effect = load
        data = self.client.get(self.url).data
        self.assertFalse(data['complete'])
        self.assertIsNone(data['value_inr'])
        self.assertIsNone(data['gain_inr'])
        self.assertEqual(data['holdings'][0]['value_inr'], '6.17')
        self.assertEqual(data['holdings'][1]['error'], 'Temporarily unavailable')

    @patch.object(market_data, 'quote', return_value={'current_price': 50, 'currency': 'USDT', 'stale': False})
    def test_wrong_currency_is_not_valued_as_inr(self, quote):
        self.assertIsNone(self.client.get(self.url).data['value_inr'])

    @patch.object(market_data, 'quote')
    def test_inactive_assets_never_contact_provider(self, quote):
        self.asset.active = False
        self.asset.save()
        self.assertFalse(self.client.get(self.url).data['complete'])
        quote.assert_not_called()

    @patch.object(market_data, 'quote', return_value={'current_price': 123.45, 'currency': 'INR', 'stale': False})
    def test_large_quantity_keeps_decimal_precision(self, quote):
        self.holding.quantity = Decimal('123456789012345.000000000000')
        self.holding.save()
        self.assertEqual(self.client.get(self.url).data['value_inr'], '15240740603573990.25')
