"""
Domain rules shared by serializers, views and the admin.

These helpers encode the decisions PROJECT_CONTEXT.md calls out explicitly:

* Quantities are validated against each asset's ``quantity_step`` so stocks
  stay whole-share and crypto respects its configured precision.
* A quantity that rounds to zero at the asset's precision is rejected rather
  than silently dropped.
* Cash is a non-negative, finite INR amount, and "confirmed zero" is tracked
  separately from "never entered" via ``Portfolio.cash_confirmed``.
* Money settles to a single documented precision (2 INR decimals).
"""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, localcontext

from django.conf import settings
from rest_framework import serializers

INR_QUANTUM = Decimal(1).scaleb(-settings.INR_DECIMAL_PLACES)  # e.g. 0.01


def to_decimal(value, field_name="value"):
    """Coerce input to a finite Decimal or raise a DRF ValidationError."""
    try:
        result = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        raise serializers.ValidationError({field_name: "Must be a number."})
    if not result.is_finite():
        raise serializers.ValidationError({field_name: "Must be a finite number."})
    return result


def quantize_inr(amount: Decimal) -> Decimal:
    """Round an INR amount to the documented money precision."""
    return amount.quantize(INR_QUANTUM, rounding=ROUND_HALF_UP)


def validate_cash(value, field_name="cash_inr") -> Decimal:
    """Validate a cash amount: finite, non-negative, settled to INR precision."""
    amount = to_decimal(value, field_name)
    if amount < 0:
        raise serializers.ValidationError(
            {field_name: "Cash cannot be negative."}
        )
    if amount >= Decimal("1e18"):
        raise serializers.ValidationError({field_name: "Amount must be below 1e18 INR."})
    result = quantize_inr(amount)
    if result >= Decimal("1e18"):
        raise serializers.ValidationError({field_name: "Rounded amount exceeds storage limit."})
    return result


def validate_quantity(value, asset, field_name="quantity") -> Decimal:
    """
    Validate a holding quantity against an asset's ``quantity_step``.

    * Must be finite and strictly positive.
    * Must be an exact multiple of the asset's step (whole shares for stocks,
      the configured precision for crypto).
    * Must not round to zero at the asset's precision.
    """
    qty = to_decimal(value, field_name)
    if qty <= 0:
        raise serializers.ValidationError(
            {field_name: "Quantity must be greater than zero."}
        )

    if qty >= Decimal("1e18") or qty.as_tuple().exponent < -12:
        raise serializers.ValidationError({field_name: "Use fewer than 18 integer digits and at most 12 decimals."})
    step = Decimal(1) if asset.asset_class == "stock" else asset.quantity_step
    if step <= 0:
        raise serializers.ValidationError(
            {field_name: "Asset has an invalid quantity step."}
        )

    # Snap to the step to detect a value that rounds to zero, then require the
    # original input to already be an exact multiple of the step.
    snapped = (qty / step).to_integral_value(rounding=ROUND_HALF_UP) * step
    if snapped <= 0:
        raise serializers.ValidationError(
            {field_name: "Quantity is smaller than the asset's minimum step."}
        )
    with localcontext() as context:
        context.prec = 64
        remainder = qty % step
    if remainder != 0:
        raise serializers.ValidationError(
            {field_name: (
                f"Quantity must be a multiple of {step} for {asset.symbol}."
            )}
        )
    return qty
