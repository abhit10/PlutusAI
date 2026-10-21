# Contributing to PlutusAI

Follow the setup in [README.md](README.md). Each contributor should use their own
local environment file and database. Never commit credentials or database copies.

## Workflow

1. Pull the latest `main` and create a branch, for example `git switch -c feature/asset-search`.
2. Keep changes focused and add tests when behavior changes.
3. Run the checks in the README before pushing.
4. Open a pull request explaining the change and how you tested it.
5. Ask a teammate to review before merging into `main`.

Commit Django migrations together with model changes. Keep `pnpm-lock.yaml` and
`uv.lock` updated when their dependencies change; do not introduce an npm lockfile.
If changing Python dependencies, update `requirements.txt` too so the pip setup
continues to match the locked environment.

Preserve portfolio ownership, Decimal precision, version checks and CSRF/session
handling. Never substitute fabricated market prices or predictions for unavailable data.
Use PostgreSQL when testing locking or financial precision; SQLite is only a smoke test.

## Repository setup for maintainers

After publishing, invite teammates through the repository's collaborator settings.
Protect `main` with pull request reviews and the CI checks when available for the
repository. Choose a license with the team before distributing the project publicly;
this starter does not grant an open-source license.
