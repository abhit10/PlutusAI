"""DRF serializers for the core API."""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Asset, Holding, Portfolio, PortfolioChange

User = get_user_model()


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128, style={"input_type": "password"})
    name = serializers.CharField(required=False, allow_blank=True, max_length=150)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(username=value).exists() or User.objects.filter(email=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        email = validated_data["email"]
        user = User(username=email, email=email, first_name=validated_data.get("name", ""))
        user.set_password(validated_data["password"])
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False, max_length=128, style={"input_type": "password"})


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name")

    class Meta:
        model = User
        fields = ["id", "email", "name"]


class AssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = [
            "id", "symbol", "name", "asset_class", "sector",
            "currency", "quantity_step", "active",
        ]


class HoldingSerializer(serializers.ModelSerializer):
    quantity_step = serializers.DecimalField(source="asset.quantity_step", max_digits=24, decimal_places=12, read_only=True)
    entered_cost_inr = serializers.SerializerMethodField()

    def get_entered_cost_inr(self, holding):
        from decimal import Decimal, localcontext, ROUND_HALF_UP
        if holding.avg_cost_inr is None:
            return None
        with localcontext() as context:
            context.prec = 64
            return format((holding.quantity * holding.avg_cost_inr).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP), "f")

    symbol = serializers.CharField(source="asset.symbol", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    asset_class = serializers.CharField(source="asset.asset_class", read_only=True)

    class Meta:
        model = Holding
        fields = [
            "id", "asset", "symbol", "asset_name", "asset_class",
            "quantity", "quantity_step", "avg_cost_inr", "entered_cost_inr", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class PortfolioSerializer(serializers.ModelSerializer):
    holdings = HoldingSerializer(many=True, read_only=True)

    class Meta:
        model = Portfolio
        fields = [
            "id", "name", "asset_class", "kind", "parent", "version",
            "cash_inr", "cash_confirmed",
            "coverage_complete", "coverage_note", "last_confirmed_at",
            "holdings", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "version", "cash_confirmed", "last_confirmed_at",
            "holdings", "created_at", "updated_at",
        ]


class PortfolioChangeSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        from copy import deepcopy
        result = super().to_representation(instance)
        # Preserve stored historical audit evidence; present only this market's holdings.
        market = self.context.get("asset_class")
        if market:
            result["detail"] = deepcopy(result["detail"])
            for key in ("before", "after"):
                state = result["detail"].get(key)
                if isinstance(state, dict) and isinstance(state.get("holdings"), list):
                    state["holdings"] = [h for h in state["holdings"] if h.get("asset_class") == market]
                    state["asset_class"] = market
        return result

    class Meta:
        model = PortfolioChange
        fields = [
            "id", "change_type", "old_version", "new_version",
            "detail", "reason", "created_at",
        ]
