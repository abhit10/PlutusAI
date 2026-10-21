"""Bounded, strict request contracts shared by every write route."""
from rest_framework import serializers
from .domain import validate_cash, validate_quantity
from .models import Asset


class StrictInput(serializers.Serializer):
    def to_internal_value(self, data):
        if not isinstance(data, dict):
            raise serializers.ValidationError("Expected an object.")
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError({k: "Unknown or read-only field." for k in unknown})
        return super().to_internal_value(data)


class Quantity(serializers.CharField):
    def to_internal_value(self, data):
        if not isinstance(data, str):
            raise serializers.ValidationError("Send quantities as decimal strings.")
        return super().to_internal_value(data)


class Version(serializers.IntegerField):
    def to_internal_value(self, data):
        if type(data) is not int:
            raise serializers.ValidationError("Send expected_version as an integer.")
        return super().to_internal_value(data)


class Money(serializers.Field):
    def to_internal_value(self, data):
        if not isinstance(data, str) or len(data) > 64:
            raise serializers.ValidationError("Send money as a decimal string.")
        return validate_cash(data)


class HoldingInput(StrictInput):
    symbol = serializers.CharField(max_length=32)
    quantity = Quantity(max_length=64)
    avg_cost_inr = Money(required=False, allow_null=True)

    def validate(self, data):
        try:
            asset = Asset.objects.get(symbol=data.pop("symbol").upper())
        except Asset.DoesNotExist:
            raise serializers.ValidationError({"symbol": "Choose a supported active asset."})
        if not asset.active and asset.id not in self.context.get("existing_asset_ids", set()):
            raise serializers.ValidationError({"symbol": "Choose a supported active asset."})
        data["quantity"] = validate_quantity(data["quantity"], asset)
        data["asset"] = asset
        return data


class PortfolioInput(StrictInput):
    asset_class = serializers.ChoiceField(choices=Asset.AssetClass.choices, required=False)
    name = serializers.CharField(max_length=128, required=False)
    kind = serializers.ChoiceField(choices=["mirror"], required=False)
    cash_inr = Money(required=False)
    cash_confirmed = serializers.BooleanField(required=False)
    coverage_complete = serializers.BooleanField(required=False)
    coverage_note = serializers.CharField(max_length=2000, allow_blank=True, required=False)
    holdings = HoldingInput(many=True, required=False, max_length=200)
    expected_version = Version(min_value=1, required=False)
    reason = serializers.CharField(max_length=255, allow_blank=True, required=False)

    def validate(self, data):
        market = self.context.get("asset_class")
        if market is None:
            if "asset_class" not in data:
                raise serializers.ValidationError({"asset_class": "Choose stock or crypto."})
            market = data["asset_class"]
        elif "asset_class" in data and data["asset_class"] != market:
            raise serializers.ValidationError({"asset_class": "A portfolio's market cannot be changed. Create another portfolio."})
        holdings = data.get("holdings", [])
        if any(h["asset"].asset_class != market for h in holdings):
            message = ("This is a stocks portfolio; add crypto in a crypto portfolio." if market == "stock"
                       else "This is a crypto portfolio; add stocks in a stocks portfolio.")
            raise serializers.ValidationError({"holdings": message})
        ids = [h["asset"].id for h in holdings]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError({"holdings": "Each asset may appear once."})
        return data
