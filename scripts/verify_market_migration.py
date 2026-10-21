"""Exercise the real market migration in an isolated, in-memory SQLite database."""
import os
import sys
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
from django.conf import settings
settings.DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
import django
django.setup()
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

old = [('core', '0003_alter_portfoliochange_change_type')]
new = [('core', '0004_portfolio_markets')]
executor = MigrationExecutor(connection)
executor.migrate(old)
apps = executor.loader.project_state(old).apps
User = apps.get_model('auth', 'User')
Portfolio = apps.get_model('core', 'Portfolio')
Asset = apps.get_model('core', 'Asset')
Holding = apps.get_model('core', 'Holding')
Change = apps.get_model('core', 'PortfolioChange')
user = User.objects.create(username='migration-test')
stock = Asset.objects.create(symbol='STOCK', name='Stock', asset_class='stock')
coin = Asset.objects.create(symbol='COIN', name='Coin', asset_class='crypto', quantity_step='0.00000001')
mixed = Portfolio.objects.create(owner=user, name='Original', kind='sample', version=7, cash_inr='35')
stock_h = Holding.objects.create(portfolio=mixed, asset=stock, quantity='12', avg_cost_inr=None)
crypto_h = Holding.objects.create(portfolio=mixed, asset=coin, quantity='0.12345678', avg_cost_inr='100.25')
audit = Change.objects.create(portfolio=mixed, change_type='opening', old_version=0, new_version=7, detail={'original': 'evidence'})
crypto_only = Portfolio.objects.create(owner=user, name='Crypto only')
Holding.objects.create(portfolio=crypto_only, asset=coin, quantity='0.5')
empty = Portfolio.objects.create(owner=user, name='Empty')
executor = MigrationExecutor(connection)
executor.migrate(new)
apps = executor.loader.project_state(new).apps
Portfolio = apps.get_model('core', 'Portfolio')
Holding = apps.get_model('core', 'Holding')
Change = apps.get_model('core', 'PortfolioChange')
original = Portfolio.objects.get(pk=mixed.pk)
split = Portfolio.objects.get(name='Original · Crypto')
assert original.asset_class == 'stock' and original.version == 8
assert split.asset_class == 'crypto' and split.kind == 'sample' and split.owner_id == user.pk
assert original.cash_inr == Decimal('35') and split.cash_inr == 0
assert Holding.objects.count() == 3
assert Holding.objects.get(pk=stock_h.pk).portfolio_id == original.pk
moved = Holding.objects.get(pk=crypto_h.pk)
assert moved.portfolio_id == split.pk and moved.quantity == Decimal('0.12345678')
assert moved.avg_cost_inr == Decimal('100.25') and moved.updated_at == crypto_h.updated_at
assert Change.objects.get(pk=audit.pk).detail == {'original': 'evidence'}
assert Change.objects.filter(portfolio_id=split.pk, detail={'original': 'evidence'}).exists()
assert Portfolio.objects.get(pk=crypto_only.pk).asset_class == 'crypto'
assert Portfolio.objects.get(pk=empty.pk).asset_class == 'stock'
for p in Portfolio.objects.all():
    assert not p.holdings.exclude(asset__asset_class=p.asset_class).exists()
print('PASS: real migration preserves holding IDs, amounts, costs, owner, samples and original audit; all books single-market.')
