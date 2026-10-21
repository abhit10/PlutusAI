from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Asset, Holding, Portfolio, PortfolioChange


class FoundationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('owner@example.test', password='Good-password-81')
        self.other = get_user_model().objects.create_user('other@example.test', password='Good-password-81')
        Asset.objects.create(symbol='STOCK', name='Test stock', asset_class='stock', quantity_step=1)
        Asset.objects.create(symbol='COIN', name='Test coin', asset_class='crypto', quantity_step='0.00000001')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def create(self, **extra):
        return self.client.post('/api/portfolios/', {'name': 'My portfolio', 'asset_class': 'stock', **extra}, format='json')

    def test_opening_and_unknown_cost(self):
        response = self.create(holdings=[{'symbol': 'STOCK', 'quantity': '123456'}])
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data['holdings'][0]['avg_cost_inr'])
        self.assertFalse(response.data['cash_confirmed'])
        self.assertEqual(PortfolioChange.objects.get().change_type, 'opening')
        self.assertEqual(Holding.objects.get().quantity, Decimal('123456'))
        self.assertNotIn('profit', response.data)

    def test_invalid_opening_rolls_back(self):
        for value in ['-1', 'NaN', 'Infinity', '1e100', '999999999999999999.999']:
            self.assertEqual(self.create(cash_inr=value).status_code, 400, value)
        for symbol, value in [('STOCK', '0.5'), ('STOCK', '0'), ('COIN', '0.000000001'), ('COIN', '1e100')]:
            self.assertEqual(self.create(asset_class='stock' if symbol == 'STOCK' else 'crypto', holdings=[{'symbol': symbol, 'quantity': value}]).status_code, 400)
        self.assertEqual(Portfolio.objects.count(), 0)

    def test_version_audit_and_confirmation(self):
        p = self.create(asset_class='crypto', cash_inr='0', holdings=[{'symbol': 'COIN', 'quantity': '0.12345678'}]).data
        self.assertTrue(p['cash_confirmed'])
        url = f"/api/portfolios/{p['id']}/"
        self.assertEqual(self.client.patch(url, {'name': 'Missing version'}, format='json').status_code, 409)
        result = self.client.patch(url, {'expected_version': 1, 'name': 'Renamed'}, format='json')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.client.patch(url, {'expected_version': 1, 'name': 'Stale'}, format='json').status_code, 409)
        self.assertEqual(PortfolioChange.objects.count(), 2)
        confirm = self.client.post(url+'confirm/', {'expected_version': 2, 'coverage_complete': False, 'coverage_note': 'Unsupported gold'}, format='json')
        self.assertEqual(confirm.status_code, 200)
        self.assertFalse(confirm.data['coverage_complete'])
        self.assertIsNotNone(confirm.data['last_confirmed_at'])

    def test_cross_user_every_route(self):
        p = self.create().data
        self.client.force_authenticate(self.other)
        url = f"/api/portfolios/{p['id']}/"
        self.assertEqual(self.client.get('/api/portfolios/').data['count'], 0)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertTrue(Portfolio.objects.filter(pk=p["id"]).exists())
        self.assertEqual(self.client.get(url+'changes/').status_code, 404)
        self.assertEqual(self.client.patch(url, {'expected_version': 1, 'name': 'Stolen'}, format='json').status_code, 404)
        for route, payload in [('cash/', {'cash_inr': '0'}), ('confirm/', {}), ('holdings/', {'symbol': 'STOCK', 'quantity': '1'}), ('holdings/remove/', {'symbol': 'STOCK'})]:
            self.assertEqual(self.client.post(url+route, {'expected_version': 1, **payload}, format='json').status_code, 404)
        self.assertEqual(self.create(parent=p['id']).status_code, 400)

    def test_owner_delete_removes_only_owned_portfolio(self):
        p = self.create(holdings=[{'symbol': 'STOCK', 'quantity': '2'}]).data
        other = Portfolio.objects.create(owner=self.other, name='Keep', asset_class='stock')
        url = f"/api/portfolios/{p['id']}/"
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(Portfolio.objects.filter(pk=p['id']).exists())
        self.assertFalse(Holding.objects.filter(portfolio_id=p['id']).exists())
        self.assertFalse(PortfolioChange.objects.filter(portfolio_id=p['id']).exists())
        self.assertTrue(Portfolio.objects.filter(pk=other.pk).exists())
        self.assertEqual(self.client.delete(url).status_code, 404)
        self.assertEqual(self.client.get('/api/portfolios/').data['count'], 0)

    def test_delete_requires_session_and_csrf(self):
        p = self.create().data
        url = f"/api/portfolios/{p['id']}/"
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(client.delete(url).status_code, 403)
        client.force_login(self.user)
        self.assertEqual(client.delete(url).status_code, 403)
        client.get('/api/auth/csrf/')
        self.assertEqual(client.delete(url, HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value).status_code, 204)

    def test_entered_cost_basis_is_decimal_and_unknown_stays_unknown(self):
        p = self.create(asset_class='crypto', holdings=[{'symbol': 'COIN', 'quantity': '0.12345678', 'avg_cost_inr': '1234.56'}]).data
        rows = {h['symbol']: h for h in p['holdings']}
        self.assertEqual(rows['COIN']['entered_cost_inr'], '152.41')
        self.assertEqual(rows['COIN']['quantity_step'], '0.000000010000')
        stock = self.create(holdings=[{'symbol': 'STOCK', 'quantity': '2'}]).data
        self.assertIsNone(stock['holdings'][0]['entered_cost_inr'])

    def test_real_session_csrf_login_logout(self):
        client = APIClient(enforce_csrf_checks=True)
        payload = {'email': 'new@example.test', 'password': 'Uncommon-pass-9182', 'name': 'New'}
        self.assertEqual(client.post('/api/auth/signup/', payload, format='json').status_code, 403)
        client.get('/api/auth/csrf/')
        def post(url, data):
            return client.post(url, data, format='json', HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
        self.assertEqual(post('/api/auth/signup/', payload).status_code, 201)
        self.assertEqual(client.get('/api/auth/me/').status_code, 200)
        self.assertEqual(post('/api/auth/logout/', {}).status_code, 204)
        self.assertEqual(client.get('/api/portfolios/').status_code, 403)
        self.assertEqual(client.post('/api/auth/login/', payload, format='json').status_code, 403)
        self.assertEqual(post('/api/auth/login/', payload).status_code, 200)
        self.assertEqual(client.get('/api/assets/').status_code, 200)

    def test_edit_preserves_omitted_cost_and_invalid_is_atomic(self):
        p = self.create(holdings=[{'symbol': 'STOCK', 'quantity': '2', 'avg_cost_inr': '12.345'}]).data
        url = f"/api/portfolios/{p['id']}/holdings/"
        response = self.client.post(url, {'expected_version': 1, 'symbol': 'STOCK', 'quantity': '3'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['holdings'][0]['avg_cost_inr'], '12.35')
        bad = self.client.post(url, {'expected_version': 2, 'symbol': 'STOCK', 'quantity': '-1'}, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(Portfolio.objects.get().version, 2)
        self.assertEqual(PortfolioChange.objects.count(), 2)

    def test_strict_types_duplicates_inactive_and_confirmation_reset(self):
        self.assertEqual(self.create(cash_inr=12.5).status_code, 400)
        self.assertEqual(self.create(holdings=[{'symbol': 'STOCK', 'quantity': 1}]).status_code, 400)
        rows = [{'symbol': 'STOCK', 'quantity': '1'}] * 2
        self.assertEqual(self.create(holdings=rows).status_code, 400)
        Asset.objects.filter(symbol='COIN').update(active=False)
        self.assertEqual(self.create(asset_class='crypto', holdings=[{'symbol': 'COIN', 'quantity': '1'}]).status_code, 400)
        p = self.create().data
        url = f"/api/portfolios/{p['id']}/"
        self.assertEqual(self.client.patch(url, {'expected_version': True, 'name': 'Bad'}, format='json').status_code, 400)
        self.client.post(url+'confirm/', {'expected_version': 1}, format='json')
        changed = self.client.post(url+'cash/', {'expected_version': 2, 'cash_inr': '0'}, format='json')
        self.assertFalse(changed.data['coverage_complete'])
        self.assertIsNone(changed.data['last_confirmed_at'])

    def test_malformed_action_and_inactive_existing_position(self):
        p = self.create(holdings=[{'symbol': 'STOCK', 'quantity': '1'}]).data
        url = f"/api/portfolios/{p['id']}/holdings/"
        self.assertEqual(self.client.post(url, [], format='json').status_code, 400)
        Asset.objects.filter(symbol='STOCK').update(active=False)
        response = self.client.post(url, {'expected_version': 1, 'symbol': 'STOCK', 'quantity': '2'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['holdings']), 1)

    def test_market_required_immutable_and_mixed_opening_rejected(self):
        self.assertEqual(self.client.post('/api/portfolios/', {'name': 'Missing'}, format='json').status_code, 400)
        self.assertEqual(self.create(asset_class='all').status_code, 400)
        for market in ('stock', 'crypto'):
            response = self.create(asset_class=market, holdings=[{'symbol': 'STOCK', 'quantity': '1'}, {'symbol': 'COIN', 'quantity': '0.1'}])
            self.assertEqual(response.status_code, 400)
        self.assertEqual(Portfolio.objects.count(), 0)
        p = self.create().data
        response = self.client.patch(f"/api/portfolios/{p['id']}/", {'asset_class': 'crypto', 'expected_version': 1}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Portfolio.objects.get().asset_class, 'stock')
        self.assertEqual(Portfolio.objects.get().version, 1)

    def test_wrong_market_upsert_and_replacement_atomic(self):
        for market, own, wrong in [('stock', 'STOCK', 'COIN'), ('crypto', 'COIN', 'STOCK')]:
            p = self.create(asset_class=market, holdings=[{'symbol': own, 'quantity': '1'}]).data
            url = f"/api/portfolios/{p['id']}/"
            payload = {'expected_version': 1, 'symbol': wrong, 'quantity': '1'}
            response = self.client.post(url+'holdings/', payload, format='json')
            self.assertEqual(response.status_code, 400)
            self.assertIn('portfolio', str(response.data))
            response = self.client.patch(url, {'expected_version': 1, 'holdings': [{'symbol': wrong, 'quantity': '1'}]}, format='json')
            self.assertEqual(response.status_code, 400)
            saved = Portfolio.objects.get(pk=p['id'])
            self.assertEqual(saved.version, 1)
            self.assertEqual(saved.holdings.get().asset.symbol, own)
            self.assertEqual(saved.changes.count(), 1)

    def test_market_filtered_lists_details_assets_and_ownership(self):
        stock = self.create().data
        crypto = self.create(asset_class='crypto').data
        for market, p, other in [('stock', stock, crypto), ('crypto', crypto, stock)]:
            result = self.client.get('/api/portfolios/', {'asset_class': market})
            self.assertEqual([row['id'] for row in result.data['results']], [p['id']])
            self.assertEqual(self.client.get(f"/api/portfolios/{other['id']}/?asset_class={market}").status_code, 404)
            assets = self.client.get('/api/assets/', {'asset_class': market, 'search': 'Test'}).data['results']
            self.assertTrue(assets)
            self.assertTrue(all(a['asset_class'] == market for a in assets))
        self.assertEqual(self.client.get('/api/portfolios/?asset_class=all').status_code, 400)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get('/api/portfolios/?asset_class=stock').data['count'], 0)
        self.assertEqual(self.client.get(f"/api/portfolios/{crypto['id']}/?asset_class=crypto").status_code, 404)


    def test_historical_market_projection_preserves_stored_audit(self):
        stock = self.create().data
        crypto = self.create(asset_class='crypto').data
        detail = {'before': None, 'after': {'name': 'Historical', 'holdings': [
            {'symbol': 'STOCK', 'asset_class': 'stock'},
            {'symbol': 'COIN', 'asset_class': 'crypto'},
        ]}}
        for portfolio in (stock, crypto):
            event = PortfolioChange.objects.create(portfolio_id=portfolio['id'], change_type='manual_edit', old_version=1, new_version=2, detail=detail)
            response = self.client.get(f"/api/portfolios/{portfolio['id']}/changes/")
            rendered = next(row for row in response.data['results'] if row['id'] == event.pk)
            self.assertEqual([h['asset_class'] for h in rendered['detail']['after']['holdings']], [portfolio['asset_class']])
            event.refresh_from_db()
            self.assertEqual(event.detail, detail)



from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from django.db import close_old_connections
from django.test import TransactionTestCase, skipUnlessDBFeature


class PostgreSQLConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature('has_select_for_update')
    def test_large_decimal_values_round_trip(self):
        user = get_user_model().objects.create_user('precision@example.test')
        Asset.objects.create(symbol='PRECISE', name='Precision test', asset_class='crypto', quantity_step='0.000000000001')
        client = APIClient()
        client.force_authenticate(user)
        response = client.post('/api/portfolios/', {
            'asset_class': 'crypto', 'cash_inr': '999999999999999999.99',
            'holdings': [{'symbol': 'PRECISE', 'quantity': '999999999999999999.123456789012'}],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        fetched = client.get(f"/api/portfolios/{response.data['id']}/").data
        self.assertEqual(fetched['cash_inr'], '999999999999999999.99')
        self.assertEqual(fetched['holdings'][0]['quantity'], '999999999999999999.123456789012')

    @skipUnlessDBFeature('has_select_for_update')
    def test_simultaneous_edits_have_one_winner(self):
        user = get_user_model().objects.create_user('concurrent@example.test')
        portfolio = Portfolio.objects.create(owner=user, asset_class='stock')
        barrier = Barrier(2)

        def edit(name):
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(user)
                barrier.wait(timeout=10)
                return client.patch(f'/api/portfolios/{portfolio.pk}/',
                    {'expected_version': 1, 'name': name}, format='json').status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(edit, ['First', 'Second']))
        self.assertEqual(sorted(statuses), [200, 409])
        portfolio.refresh_from_db()
        self.assertEqual(portfolio.version, 2)
        self.assertEqual(portfolio.changes.count(), 1)
