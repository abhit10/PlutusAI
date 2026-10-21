"""
Core API views.

Auth is session based. Every mutation to a portfolio runs inside a DB
transaction, checks an ``expected_version`` for optimistic concurrency
(returning HTTP 409 on mismatch), bumps the version, and writes an immutable
PortfolioChange row.
"""
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import transaction, IntegrityError
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.utils.decorators import method_decorator
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Asset, Holding, Portfolio, PortfolioChange
from .serializers import (
    AssetSerializer,
    LoginSerializer,
    PortfolioChangeSerializer,
    PortfolioSerializer,
    SignupSerializer,
    UserSerializer,
)

User = get_user_model()


@method_decorator(ensure_csrf_cookie, name="get")
class CsrfView(APIView):
    """GET to prime the csrftoken cookie before any unsafe request."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


@method_decorator(csrf_protect, name="dispatch")
class SignupView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
        except IntegrityError:
            return Response({"email": ["An account with this email already exists."]}, status=400)
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = authenticate(
            request, username=email, password=serializer.validated_data["password"]
        )
        if user is None:
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class AssetViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only asset reference. Symbol is the public lookup key."""

    serializer_class = AssetSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "symbol"
    lookup_value_regex = "[^/]+"

    def get_queryset(self):
        qs = Asset.objects.all()
        asset_class = self.request.query_params.get("asset_class")
        if asset_class:
            qs = qs.filter(asset_class=asset_class)
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(symbol__icontains=search) | qs.filter(name__icontains=search)
        return qs.distinct()


class PortfolioViewSet(viewsets.GenericViewSet):
    """Owner-scoped atomic manual edits; no trade or performance side effects."""
    serializer_class = PortfolioSerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        from rest_framework.exceptions import ValidationError
        super().initial(request, *args, **kwargs)
        if request.method in {"POST", "PATCH"}:
            if int(request.META.get("CONTENT_LENGTH") or 0) > 262144:
                raise ValidationError({"detail": "Request exceeds 256 KiB."})
            if not isinstance(request.data, dict):
                raise ValidationError({"detail": "Expected a JSON object."})

    def get_queryset(self):
        qs = Portfolio.objects.filter(owner=self.request.user).prefetch_related("holdings__asset")
        market = self.request.query_params.get("asset_class")
        if market is not None:
            from rest_framework.exceptions import ValidationError
            if market not in {"stock", "crypto"}:
                raise ValidationError({"asset_class": "Choose stock or crypto."})
            qs = qs.filter(asset_class=market)
        return qs

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(PortfolioSerializer(page, many=True).data)

    def retrieve(self, request, pk=None):
        return Response(PortfolioSerializer(self.get_object()).data)

    def destroy(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        with transaction.atomic():
            portfolio = get_object_or_404(
                Portfolio.objects.select_for_update(), pk=pk, owner=request.user)
            portfolio.delete()
        return Response(status=204)

    def snapshot(self, portfolio):
        return dict(PortfolioSerializer(portfolio).data)

    def write(self, request, pk=None, payload=None, change_type="manual_edit", confirm=False):
        from .inputs import PortfolioInput
        from rest_framework.exceptions import ValidationError
        from django.shortcuts import get_object_or_404
        with transaction.atomic():
            portfolio = Portfolio(owner=request.user) if pk is None else get_object_or_404(
                Portfolio.objects.select_for_update(), pk=pk, owner=request.user)
            existing_ids = set(portfolio.holdings.values_list("asset_id", flat=True)) if pk else set()
            serializer = PortfolioInput(data=request.data if payload is None else payload,
                context={"existing_asset_ids": existing_ids, "asset_class": portfolio.asset_class if pk else None})
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            reason = data.pop("reason", "")
            expected = data.pop("expected_version", None)
            if pk is None:
                before = None
                old_version = 0
            else:
                if expected != portfolio.version:
                    return Response({"detail": "Portfolio changed or expected_version is missing. Reload and retry.", "current_version": portfolio.version}, status=409)
                before = self.snapshot(portfolio)
                old_version = portfolio.version
            holdings = data.pop("holdings", None)
            if data.get("cash_confirmed") and "cash_inr" not in data and not portfolio.cash_confirmed:
                raise ValidationError({"cash_inr": "Enter cash explicitly to confirm it, including zero."})
            if "cash_inr" in data:
                data.setdefault("cash_confirmed", True)
            for field, value in data.items():
                setattr(portfolio, field, value)
            if confirm:
                portfolio.last_confirmed_at = timezone.now()
            elif pk is not None and (holdings is not None or "cash_inr" in data):
                portfolio.coverage_complete = False
                portfolio.last_confirmed_at = None
            portfolio.version = old_version + 1
            portfolio.save()
            if holdings is not None:
                portfolio.holdings.all().delete()
                Holding.objects.bulk_create([Holding(portfolio=portfolio, **h) for h in holdings])
            after = self.snapshot(portfolio)
            PortfolioChange.objects.create(portfolio=portfolio, change_type="opening" if pk is None else change_type,
                old_version=old_version, new_version=portfolio.version,
                detail={"before": before, "after": after}, reason=reason)
        return Response(after, status=201 if pk is None else 200)

    def create(self, request):
        return self.write(request)

    def partial_update(self, request, pk=None):
        return self.write(request, pk)

    @action(detail=True, methods=["post"], url_path="holdings")
    def upsert_holding(self, request, pk=None):
        return self.holding_edit(request, pk, remove=False)

    @action(detail=True, methods=["post"], url_path="holdings/remove")
    def remove_holding(self, request, pk=None):
        return self.holding_edit(request, pk, remove=True)

    def holding_edit(self, request, pk, remove):
        # Read the composition under the same row lock used by the write path.
        from django.shortcuts import get_object_or_404
        with transaction.atomic():
            p = get_object_or_404(Portfolio.objects.select_for_update(), pk=pk, owner=request.user)
            symbol = str(request.data.get("symbol", "")).upper()
            rows = [{"symbol": h.asset.symbol, "quantity": str(h.quantity),
                     "avg_cost_inr": str(h.avg_cost_inr) if h.avg_cost_inr is not None else None}
                    for h in p.holdings.select_related("asset")]
            existing = next((h for h in rows if h["symbol"] == symbol), None)
            rows = [h for h in rows if h["symbol"] != symbol]
            if remove and existing is None:
                return Response({"detail": "Holding not found."}, status=404)
            if not remove:
                rows.append({"symbol": symbol, "quantity": request.data.get("quantity"),
                             "avg_cost_inr": request.data.get("avg_cost_inr", existing["avg_cost_inr"] if existing else None)})
            return self.write(request, pk, {"expected_version": request.data.get("expected_version"),
                "holdings": rows, "reason": request.data.get("reason", "")})

    @action(detail=True, methods=["post"], url_path="cash")
    def set_cash(self, request, pk=None):
        return self.write(request, pk, {"expected_version": request.data.get("expected_version"),
            "cash_inr": request.data.get("cash_inr"), "reason": request.data.get("reason", "")}, "cash_adjustment")

    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm_coverage(self, request, pk=None):
        return self.write(request, pk, {"expected_version": request.data.get("expected_version"),
            "coverage_complete": request.data.get("coverage_complete", True),
            "coverage_note": request.data.get("coverage_note", ""),
            "reason": request.data.get("reason", "")}, "coverage", confirm=True)

    @action(detail=True, methods=["get"], url_path="changes")
    def changes(self, request, pk=None):
        page = self.paginate_queryset(self.get_object().changes.all())
        return self.get_paginated_response(PortfolioChangeSerializer(page, many=True, context={"asset_class": self.get_object().asset_class}).data)
