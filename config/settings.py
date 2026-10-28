"""
Django settings for the PlutusAI backend (foundation build).

This is a single Django + Django REST Framework monolith. Only the `core`
app is implemented in this task; `trend_ai`, `asset_risk`,
`portfolio_advisor` and `chatbot` are reserved as empty placeholder apps
per PROJECT_CONTEXT.md and intentionally contain no analytical features.

Authentication uses Django sessions with CSRF protection. In development the
React (Vite) dev server proxies /api and /admin to this server, so the browser
talks to a single origin (see frontend/vite.config.ts and README.md).
"""
from pathlib import Path
import os

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables. `.env.development.local` holds the Neon
# connection string injected by the platform; `.env` is an optional override.
load_dotenv(BASE_DIR / ".env.development.local")
load_dotenv(BASE_DIR / ".env", override=False)


def env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "dev-insecure-key-change-me-in-production-0123456789abcdef",
)

DEBUG = env_bool("DJANGO_DEBUG", True)

# The sandbox/preview host is dynamic; allow all hosts in this dev foundation.
# Production must set DJANGO_ALLOWED_HOSTS to an explicit list.
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "corsheaders",
    # Local apps
    "apps.core",
    # Reserved placeholder apps (no analytical features implemented yet)
    "apps.trend_ai",
    "apps.asset_risk",
    "apps.portfolio_advisor",
    "apps.chatbot",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Database (Neon PostgreSQL) ---------------------------------------------
# Prefer the direct (unpooled) connection for reliability with migrations;
# fall back to the pooled URL or a local sqlite file if nothing is configured.
_database_url = (
    os.environ.get("DATABASE_URL_UNPOOLED")
    or os.environ.get("DATABASE_URL")
    or os.environ.get("POSTGRES_URL_NON_POOLING")
    or os.environ.get("POSTGRES_URL")
)

if _database_url:
    DATABASES = {
        "default": dj_database_url.parse(
            _database_url,
            conn_max_age=0,
            ssl_require=env_bool("DATABASE_SSL_REQUIRED", True),
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
# Store timestamps in UTC; the frontend renders session times in Asia/Kolkata.
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- Django REST Framework ---------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "auth": "30/min",
        "market": "120/min",
    },
    "UNAUTHENTICATED_USER": None,
}

# --- Session / CSRF ----------------------------------------------------------
# In development the CSRF cookie must be readable by JavaScript so the SPA can
# echo it back in the X-CSRFToken header.
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SAMESITE = "Lax"

# Explicit trusted origins can be supplied for separate-origin deployments.
_csrf_trusted = os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").strip()
CSRF_TRUSTED_ORIGINS = [o for o in _csrf_trusted.split(",") if o] or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
]

# CORS is only relevant if the frontend is served from a different origin than
# the API. The default dev setup is same-origin (Vite proxy), so this stays
# closed unless explicitly opened.
CORS_ALLOW_CREDENTIALS = True
_cors_origins = os.environ.get("DJANGO_CORS_ALLOWED_ORIGINS", "").strip()
CORS_ALLOWED_ORIGINS = [o for o in _cors_origins.split(",") if o]

# --- Domain constants --------------------------------------------------------
# One documented rounding rule: money and notional settle to 2 INR decimals.
INR_DECIMAL_PLACES = 2

SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
DATA_UPLOAD_MAX_MEMORY_SIZE = 262144
if not DEBUG and SECRET_KEY.startswith("dev-insecure"):
    raise RuntimeError("Set DJANGO_SECRET_KEY when DEBUG is false.")
