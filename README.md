# PlutusAI

A collaborative stock and cryptocurrency portfolio application built with React 19,
Vite 6, Tailwind CSS 4, Django 5.2 and Django REST Framework.

The base project includes session authentication, separate stock and crypto portfolios,
holdings management, audit history, and light/dark themes. Live market data, predictions,
risk analysis and the chatbot are future work. The animated landing page uses labelled illustrative market examples, not live prices or predictions.

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
reset or email verification. Analytics and live market integrations remain future work.
