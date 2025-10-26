# Makefile Commands

Local linting commands that mirror the GitHub Actions CI workflow.

## ⚠️ Known Issues

**If the Makefile fails, it's likely due to existing code errors, not the Makefile itself.**

Current known issues in the codebase:

- **Frontend**: Unused function `showSaveDialog` in `browser-extension/src/content/content.ts` (line 748)
- **Frontend**: Multiple console statements (warnings only, acceptable for development)
- **Backend**: Minor flake8 warnings (trailing whitespace, unused imports)

These are legitimate code quality issues that should be fixed. The Makefile is working correctly by detecting them.

## Prerequisites

- Python 3
- Node.js & npm
- Docker (optional, for Dockerfile linting)

## Linting Commands

Check your code for issues (read-only):

```bash
make lint-all       # Run all linters
make lint-frontend  # Lint TypeScript/JavaScript (ESLint)
make lint-backend   # Lint Python (flake8, black, isort)
make lint-configs   # Lint YAML, Markdown, Dockerfiles
```

## Auto-Fix Commands

Automatically fix issues where possible:

```bash
make fix-all        # Fix frontend + backend + configs
make fix-frontend   # Fix TypeScript/JavaScript (ESLint --fix)
make fix-backend    # Fix Python (black + isort)
make fix-configs    # Fix YAML files (line endings, whitespace)
```

## Recommended Workflow

```bash
# 1. Auto-fix all issues
make fix-all

# 2. Check remaining issues
make lint-all

# 3. Commit your changes
git add .
git commit -m "Your message"
```

## Notes

- Python virtual environment (`.venv/`) is created automatically
- If `make lint-all` passes locally, it should pass in CI
- Some issues (like console statements) must be fixed manually