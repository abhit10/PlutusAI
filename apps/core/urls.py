from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .market_views import MarketView, MarketHistoryView

from .views import (
    AssetViewSet,
    CsrfView,
    LoginView,
    LogoutView,
    MeView,
    PortfolioViewSet,
    SignupView,
)

router = DefaultRouter()
router.register("assets", AssetViewSet, basename="asset")
router.register("portfolios", PortfolioViewSet, basename="portfolio")

urlpatterns = [
    path("market/quote/", MarketView.as_view(), name="market-quote"),
    path("market/history/", MarketHistoryView.as_view(), name="market-history"),
    path("auth/csrf/", CsrfView.as_view(), name="csrf"),
    path("auth/signup/", SignupView.as_view(), name="signup"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/me/", MeView.as_view(), name="me"),
    path("", include(router.urls)),
]
