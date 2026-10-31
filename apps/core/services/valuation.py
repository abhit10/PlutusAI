"""Read-only INR valuations. Never write market prices into the cost ledger."""
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal, ROUND_HALF_UP, localcontext

from . import market_data


def money(value):
    return format(value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP), 'f')


def value_holding(holding):
    row = {'symbol': holding.asset.symbol, 'quote': None, 'value_inr': None,
           'gain_inr': None, 'error': None}
    if not holding.asset.active:
        row['error'] = 'This asset is no longer available for market quotes.'
        return row
    try:
        quote = market_data.quote(holding.asset)
    except market_data.MarketUnavailable as exc:
        row['error'] = str(exc)
        return row
    price = Decimal(str(quote['current_price']))
    if quote['currency'] != 'INR' or not price.is_finite() or price <= 0:
        row['error'] = 'A valid INR quote is unavailable.'
        return row
    # Quantities can have 30 digits; default Decimal precision is insufficient.
    with localcontext() as ctx:
        ctx.prec = 80
        value = holding.quantity * price
        row.update(quote=quote, value_inr=money(value))
        if holding.avg_cost_inr is not None:
            row['gain_inr'] = money(value - holding.quantity * holding.avg_cost_inr)
    return row


def portfolio_valuation(portfolio):
    holdings = list(portfolio.holdings.select_related('asset'))
    # Bound concurrent provider work; each quote uses the shared market cache.
    with ThreadPoolExecutor(max_workers=4) as executor:
        rows = list(executor.map(value_holding, holdings))
    complete = all(row['value_inr'] is not None for row in rows)
    cost_complete = all(h.avg_cost_inr is not None for h in holdings)
    with localcontext() as ctx:
        ctx.prec = 80
        total = sum((Decimal(row['value_inr']) for row in rows if row['value_inr'] is not None), Decimal(0))
        gain = sum((Decimal(row['gain_inr']) for row in rows if row['gain_inr'] is not None), Decimal(0))
        return {'portfolio_id': portfolio.pk, 'version': portfolio.version, 'holdings': rows,
                'complete': complete, 'cost_complete': cost_complete,
                'stale': any(row['quote'] and row['quote'].get('stale') for row in rows),
                'value_inr': money(total) if complete else None,
                'gain_inr': money(gain) if complete and cost_complete else None}
