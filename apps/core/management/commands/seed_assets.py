"""
Seed the asset reference table with a small, realistic Indian-market set
plus a couple of crypto assets. Idempotent: safe to run repeatedly.

These are reference rows only (symbol, class, sector, quantity step). No
prices or market data are stored, consistent with the foundation scope.
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.core.models import Asset

STOCKS = [
    ("RELIANCE", "Reliance Industries", "Energy"),
    ("TCS", "Tata Consultancy Services", "IT"),
    ("HDFCBANK", "HDFC Bank", "Financials"),
    ("INFY", "Infosys", "IT"),
    ("ICICIBANK", "ICICI Bank", "Financials"),
    ("HINDUNILVR", "Hindustan Unilever", "FMCG"),
    ("ITC", "ITC", "FMCG"),
    ("SBIN", "State Bank of India", "Financials"),
    ("BHARTIARTL", "Bharti Airtel", "Telecom"),
    ("LT", "Larsen & Toubro", "Industrials"),
]

CRYPTO = [
    ("BTC", "Bitcoin", Decimal("0.00000001")),
    ("ETH", "Ethereum", Decimal("0.00000001")),
]


class Command(BaseCommand):
    help = "Seed the Asset reference table (idempotent)."

    def handle(self, *args, **options):
        created = 0
        for symbol, name, sector in STOCKS:
            _, was_created = Asset.objects.get_or_create(
                symbol=symbol,
                defaults={
                    "name": name,
                    "asset_class": Asset.AssetClass.STOCK,
                    "sector": sector,
                    "currency": "INR",
                    "quantity_step": Decimal("1"),
                    "provider": "seed",
                    "active": True,
                },
            )
            created += int(was_created)

        for symbol, name, step in CRYPTO:
            _, was_created = Asset.objects.get_or_create(
                symbol=symbol,
                defaults={
                    "name": name,
                    "asset_class": Asset.AssetClass.CRYPTO,
                    "sector": "",
                    "currency": "INR",
                    "quantity_step": step,
                    "provider": "seed",
                    "active": True,
                },
            )
            created += int(was_created)

        total = Asset.objects.count()
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete. {created} new asset(s); {total} total in table."
            )
        )
