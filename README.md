# PlutusAI

A collaborative stock and cryptocurrency portfolio application built with React 19,
Vite 6, Tailwind CSS 4, Django 5.2 and Django REST Framework.

The project includes session authentication, separate stock and crypto portfolios,
holdings management, audit history, light/dark themes, and a market explorer with
provider quotes and interactive candlestick/line charts. Predictions, risk analysis
and the chatbot are future work. The animated landing page uses labelled illustrative
market examples; the signed-in market explorer fetches real provider data.

## Requirements

- Python 3.11+ (3.12 recommended for the shared CI environment)
- Node.js 22.6+ and pnpm 11.25.0
- PostgreSQL for full precision and concurrent editing
- Git

## Local setup

Clone the team's repository and open its root directory. On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
pnpm install --frozen-lockfile
Copy-Item .env.example .env
```

On macOS/Linux, use `python3 -m venv .venv`, `.venv/bin/python` instead of
`.\.venv\Scripts\python`, and `cp .env.example .env`.

Create your own local PostgreSQL database and role. Update `DATABASE_URL` in `.env`
and replace `DJANGO_SECRET_KEY` with a random local secret. Hosted databases require
`DATABASE_SSL_REQUIRED=true`. Never commit `.env` or database contents.
`DATABASE_URL_UNPOOLED` takes precedence over `DATABASE_URL`; do not point them at
separate databases. The environment example contains placeholders only.

```powershell
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py seed_assets
.\.venv\Scripts\python manage.py runserver 127.0.0.1:8000
```

In a second terminal, run `pnpm dev:web`, then open http://localhost:3000.
The frontend proxies `/api` to Django on port 8000. Register a local account to start.
Seeding inserts supported assets without replacing existing records.

Alternatively, with uv installed, use `uv sync --locked` to install Python dependencies,
then `pnpm migrate`, `pnpm seed` and `pnpm dev` to run both services.

For a limited smoke test, leave all database URL variables unset or empty to use
SQLite. PostgreSQL is required to validate row locking and full financial precision.
Back up existing databases before migrations: migration 0004 splits mixed portfolios
into separate markets and cannot automatically merge them back.

## Project layout

| Path | Purpose |
| --- | --- |
| `frontend/src/` | React pages, components and API client |
| `frontend/tests/` | Quantity and precision tests |
| `apps/core/` | Authentication, assets, portfolios, migrations and backend tests |
| `apps/asset_risk/`, `apps/trend_ai/`, `apps/portfolio_advisor/`, `apps/chatbot/` | Future module boundaries |
| `config/` | Django settings and routing |
| `scripts/` | Migration verification |

## Checks

```powershell
.\.venv\Scripts\python manage.py check
.\.venv\Scripts\python manage.py makemigrations --check --dry-run
.\.venv\Scripts\python manage.py test apps.core --noinput
.\.venv\Scripts\python scripts/verify_market_migration.py
pnpm --dir frontend test
pnpm build
```

Django creates a separate test database; the PostgreSQL test role needs permission to
create it. Use a dedicated local/test connection. CI runs the backend against a disposable
PostgreSQL service and runs frontend tests and the production build.

## Working together

See [CONTRIBUTING.md](CONTRIBUTING.md) for branches, reviews and dependency updates.
Commit source, migrations, dependency manifests and lockfiles. Dependencies, virtual
environments, generated builds, local databases and credentials are excluded by `.gitignore`. Keep your existing local database and backups.

## Deployment considerations

Serve the frontend and `/api` from one HTTPS origin. Set a strong secret, explicit
allowed hosts and trusted origins, and `DJANGO_DEBUG=false`. Vite preview alone does
not serve the API. This repository preparation does not deploy the application.

Current limitations include process-local authentication throttling and no password
reset or email verification. Analytics remain future work.

## Market data

The signed-in stock and crypto dashboards include asset search, candlestick/line
views, volume, crosshair OHLCV details, a keyboard candle inspector, and 1D/1W/1M/1Y/ALL
ranges. Quotes poll every 20 seconds and history every five minutes while the tab is
visible. Selecting another asset or timeframe cancels outdated client requests.
Market data never changes the portfolio ledger or its Decimal purchase costs.

Authenticated read-only endpoints (active seeded assets only):

- `/api/market/quote/?symbol=RELIANCE&market=stock`
- `/api/market/history/?symbol=BTC&market=crypto&range=1M`

NSE symbols map to Yahoo's `.NS` tickers through yfinance. Quotes are last available
provider observations, not guaranteed real-time exchange feeds. For crypto, Binance's
public market-data API supplies USDT quotes and candles. The quote header converts
USDT amounts to indicative INR using a cached Yahoo `USDT-INR` quote; it includes the
conversion source, rate and timestamp. Crypto percentage change describes Binance's
rolling 24-hour USDT move, not an INR total return. Yahoo `BTC-INR`/`ETH-INR` are fallback
sources when Binance or FX is unavailable.

**Chart currency is explicit:** Binance history stays in USDT; Yahoo fallback history
is INR. Historical candles are never multiplied by today's FX. Quote and history
sources can differ during an outage and are labelled separately.

History responses contain sorted, deduplicated OHLCV bars with UTC Unix-second `time`,
`complete`, `source`, `provider_symbol`, `currency`, `interval`, `volume_unit`,
`price_basis`, `schema_version`, `fetched_at`, `stale`, `dropped_candles` and `truncated`
metadata. Invalid bars are omitted, never filled. Stock 1D means the last available
trading session; crypto 1D is the trailing day. ALL uses available weekly bars and
explicitly reports a provider limit if reached. Yahoo uses `auto_adjust=False` (no
additional dividend adjustment); its underlying OHLC may already reflect stock splits.
Binance OHLC is exchange-native. Yahoo crypto volume is provider-reported; Binance volume is base-asset units.
For future model training, retain this provenance, exclude incomplete/stale data,
handle corporate actions, and do not mix currencies or providers without normalization.
This is a read-through service, not a persistent training dataset collector.

The Django cache holds quotes for 20 seconds and history for 300 seconds. On an outage,
last successful quotes can be served for up to 15 minutes and history up to 24 hours,
always marked stale; otherwise the API returns 503 with `Retry-After: 20`. Failures
back off for 20 seconds and concurrent cache misses are coalesced. Fast response times
apply to cache hits; cold requests depend on provider latency. The default in-memory
cache and throttle are process-local: configure a shared Django cache for multiple workers.

Provider adapters have mocked regression tests in `apps/core/test_market_data.py`,
included by the normal backend test command. No market keys or migrations are required.
Dependency changes are synchronized in `pyproject.toml`, `uv.lock`, `requirements.txt`,
and the pnpm manifests/lockfile. Charts use [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/),
with attribution retained. Provider access and usage terms still apply to deployment.
