import re

from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Asset, Portfolio
from django.shortcuts import get_object_or_404
from .services.valuation import portfolio_valuation
from .services import market_data


class MarketView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "market"
    kind = "quote"

    def get(self, request):
        market = request.query_params.get("market", "")
        symbol = request.query_params.get("symbol", "").strip().upper()
        if market == "stock" and symbol.endswith(".NS"):
            symbol = symbol[:-3]
        if market not in {"stock", "crypto"} or not re.fullmatch(r"[A-Z0-9&-]{1,24}", symbol):
            raise ValidationError({"detail": "Specify a supported symbol and market (stock or crypto)."})
        range_name = request.query_params.get("range", "1M")
        if self.kind == "history" and range_name not in market_data.RANGES:
            raise ValidationError({"detail": "Range must be 1D, 1W, 1M, 1Y or ALL."})
        # Only seeded/approved active assets may cause outbound provider calls.
        asset = Asset.objects.filter(symbol=symbol, asset_class=market, active=True).first()
        if asset is None:
            raise NotFound("Asset not supported in this market.")
        try:
            payload = market_data.quote(asset) if self.kind == "quote" else market_data.history(asset, range_name)
        except market_data.MarketUnavailable as exc:
            return Response({"detail": str(exc), "code": "market_unavailable"}, status=503,
                            headers={"Retry-After": "20", "Cache-Control": "no-store"})
        return Response(payload, headers={"Cache-Control": "private, no-store"})


class MarketHistoryView(MarketView):
    kind = "history"


class PortfolioValuationView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "market"

    def get(self, request, pk):
        portfolio = get_object_or_404(Portfolio, pk=pk, owner=request.user)
        payload = portfolio_valuation(portfolio)
        # A concurrent ledger edit must not be presented as a coherent snapshot.
        if not Portfolio.objects.filter(pk=pk, owner=request.user, version=portfolio.version).exists():
            return Response({'detail': 'Portfolio changed. Refresh your portfolio.'}, status=409)
        return Response(payload, headers={'Cache-Control': 'private, no-store'})
