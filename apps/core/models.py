"""
Core data model for the PlutusAI foundation.

Scope (per PROJECT_CONTEXT.md): accounts, an asset reference table, a
manually-maintained portfolio "mirror" with holdings, optimistic version
control, and an immutable change log. No market data, pricing, or analytics.
"""
from django.conf import settings
from django.db import models


class Asset(models.Model):
    """Reference row for something a portfolio can hold."""

    class AssetClass(models.TextChoices):
        STOCK = "stock", "Stock"
        CRYPTO = "crypto", "Crypto"

    symbol = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=128)
    asset_class = models.CharField(max_length=16, choices=AssetClass.choices)
    sector = models.CharField(max_length=64, blank=True)
    currency = models.CharField(max_length=8, default="INR")
    # Provider identity is stored so a later engine can attach a data source
    # without reshaping the table.
    provider = models.CharField(max_length=64, blank=True)
    provider_asset_id = models.CharField(max_length=128, blank=True)
    # Smallest tradable increment: 1 for whole-share stocks, a fractional value
    # for crypto. Quantities are validated against this.
    quantity_step = models.DecimalField(
        max_digits=24, decimal_places=12, default=1
    )
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["symbol"]
        constraints = [models.CheckConstraint(condition=models.Q(quantity_step__gt=0), name="asset_positive_step")]

    def __str__(self):
        return f"{self.symbol} ({self.get_asset_class_display()})"


class Portfolio(models.Model):
    """
    A user's manually-maintained view of what they hold.

    ``version`` powers optimistic concurrency: every mutation increments it and
    writes a PortfolioChange row. ``cash_confirmed`` distinguishes a real,
    user-confirmed cash figure (including a confirmed zero) from a portfolio
    that has never had cash entered.
    """

    class Kind(models.TextChoices):
        MIRROR = "mirror", "Mirror"
        SCENARIO = "scenario", "Scenario"
        SAMPLE = "sample", "Sample"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="portfolios",
    )
    name = models.CharField(max_length=128, default="My Portfolio")
    asset_class = models.CharField(max_length=16, choices=Asset.AssetClass.choices)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.MIRROR)
    # Scenario/derived portfolios can point back at the mirror they branched from.
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="derived",
    )
    version = models.PositiveIntegerField(default=1)

    cash_inr = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    cash_confirmed = models.BooleanField(default=False)

    # Coverage: whether the user has told us this mirror is complete.
    coverage_complete = models.BooleanField(default=False)
    coverage_note = models.TextField(blank=True)
    last_confirmed_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [models.CheckConstraint(condition=models.Q(cash_inr__gte=0), name="portfolio_nonnegative_cash"), models.CheckConstraint(condition=models.Q(asset_class__in=["stock", "crypto"]), name="portfolio_valid_market")]

    def __str__(self):
        return f"{self.name} <{self.owner_id}> v{self.version}"


class Holding(models.Model):
    """A single asset position inside a portfolio."""

    portfolio = models.ForeignKey(
        Portfolio, on_delete=models.CASCADE, related_name="holdings"
    )
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="holdings")
    quantity = models.DecimalField(max_digits=30, decimal_places=12)
    # Optional user-entered average cost in INR; null means "not provided".
    avg_cost_inr = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["asset__symbol"]
        constraints = [
            models.UniqueConstraint(
                fields=["portfolio", "asset"], name="unique_asset_per_portfolio"
            ),
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="holding_positive_quantity"),
            models.CheckConstraint(condition=models.Q(avg_cost_inr__gte=0) | models.Q(avg_cost_inr__isnull=True), name="holding_nonnegative_cost")
        ]

    def __str__(self):
        return f"{self.quantity} {self.asset.symbol}"


class PortfolioChange(models.Model):
    """Immutable audit row written on every portfolio mutation."""

    class ChangeType(models.TextChoices):
        OPENING = "opening", "Opening balance"
        MANUAL_EDIT = "manual_edit", "Manual edit"
        HOLDING_EDIT = "holding_edit", "Holding edit"
        CASH_ADJUSTMENT = "cash_adjustment", "Cash adjustment"
        COVERAGE = "coverage", "Coverage confirmation"

    portfolio = models.ForeignKey(
        Portfolio, on_delete=models.CASCADE, related_name="changes"
    )
    change_type = models.CharField(max_length=32, choices=ChangeType.choices)
    old_version = models.PositiveIntegerField()
    new_version = models.PositiveIntegerField()
    # Structured before/after diff; shape depends on change_type.
    detail = models.JSONField(default=dict)
    reason = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.change_type} v{self.old_version}->{self.new_version}"
