from django.contrib import admin

from .models import Asset, Holding, Portfolio, PortfolioChange


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("symbol", "name", "asset_class", "sector", "quantity_step", "active")
    list_filter = ("asset_class", "active")
    search_fields = ("symbol", "name")


class HoldingInline(admin.TabularInline):
    model = Holding
    extra = 0
    readonly_fields = ('asset', 'quantity', 'avg_cost_inr')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "kind", "version", "cash_inr", "cash_confirmed", "coverage_complete")
    list_filter = ("kind", "cash_confirmed", "coverage_complete")
    search_fields = ("name", "owner__username", "owner__email")
    inlines = [HoldingInline]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PortfolioChange)
class PortfolioChangeAdmin(admin.ModelAdmin):
    list_display = ("portfolio", "change_type", "old_version", "new_version", "created_at")
    list_filter = ("change_type",)
    readonly_fields = ("portfolio", "change_type", "old_version", "new_version", "detail", "reason", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
