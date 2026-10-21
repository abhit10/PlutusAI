from copy import deepcopy
from django.db import migrations, models


def split_markets(apps, schema_editor):
    Portfolio = apps.get_model('core', 'Portfolio')
    Holding = apps.get_model('core', 'Holding')
    Change = apps.get_model('core', 'PortfolioChange')
    db = schema_editor.connection.alias
    for portfolio in Portfolio.objects.using(db).all().iterator():
        if portfolio.asset_class:
            continue
        holdings = Holding.objects.using(db).filter(portfolio_id=portfolio.pk)
        classes = set(holdings.values_list('asset__asset_class', flat=True))
        if classes - {'stock', 'crypto'}:
            raise ValueError('Unknown asset class; resolve before splitting portfolios.')
        portfolio.asset_class = 'crypto' if classes == {'crypto'} else 'stock'
        old_version = portfolio.version
        portfolio.version += 1
        portfolio.save(using=db, update_fields=['asset_class', 'version'])
        if classes == {'stock', 'crypto'}:
            crypto = Portfolio.objects.using(db).create(
                owner_id=portfolio.owner_id, name=portfolio.name[:117] + ' · Crypto',
                asset_class='crypto', kind=portfolio.kind, version=portfolio.version,
            )
            # Move the original rows, retaining IDs, quantities, costs and timestamps.
            holdings.filter(asset__asset_class='crypto').update(portfolio_id=crypto.pk)
            # Keep every original audit; copy its evidence into the new book as well.
            for change in Change.objects.using(db).filter(portfolio_id=portfolio.pk).iterator():
                copied = Change.objects.using(db).create(
                    portfolio_id=crypto.pk, change_type=change.change_type,
                    old_version=change.old_version, new_version=change.new_version,
                    detail=deepcopy(change.detail), reason=change.reason,
                )
                Change.objects.using(db).filter(pk=copied.pk).update(created_at=change.created_at)
            for target in (portfolio, crypto):
                Change.objects.using(db).create(
                    portfolio_id=target.pk, change_type='manual_edit',
                    old_version=old_version, new_version=target.version,
                    detail={'market_split': True, 'source_id': portfolio.pk, 'crypto_id': crypto.pk},
                    reason='Separated existing stocks and crypto; no trades or changes to quantities.',
                )


class Migration(migrations.Migration):
    dependencies = [('core', '0003_alter_portfoliochange_change_type')]
    operations = [
        migrations.AddField(model_name='portfolio', name='asset_class',
                            field=models.CharField(max_length=16, choices=[('stock', 'Stock'), ('crypto', 'Crypto')], null=True)),
        migrations.RunPython(split_markets),
        migrations.AlterField(model_name='portfolio', name='asset_class',
                              field=models.CharField(max_length=16, choices=[('stock', 'Stock'), ('crypto', 'Crypto')])),
        migrations.AddConstraint(model_name='portfolio', constraint=models.CheckConstraint(
            condition=models.Q(asset_class__in=['stock', 'crypto']), name='portfolio_valid_market')),
    ]
