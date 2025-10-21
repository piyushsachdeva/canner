# Linting Quick Reference 🚀

Quick commands for running lints locally before pushing code.

## Browser Extension (TypeScript/React)

```bash
cd browser-extension

# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix

# CI mode (zero warnings)
npm run lint:check
```

## Backend (Python)

```bash
cd backend

# Check style
flake8 .

# Format code (auto-fix)
black .

# Sort imports (auto-fix)
isort .

# Check without changes
black --check .
isort --check-only .

# Run all checks
flake8 . && black --check . && isort --check-only .

# Auto-fix all
black . && isort .
```

## Dockerfiles

```bash
# Lint backend Dockerfile
hadolint backend/Dockerfile

# Using Docker
docker run --rm -i hadolint/hadolint < backend/Dockerfile
```

## YAML Files

```bash
# Lint all YAML
yamllint -c .yamllint.yaml .github/workflows/*.yml docker-compose.yml

# Lint specific file
yamllint -c .yamllint.yaml docker-compose.yml
```

## Markdown Files

```bash
# Check all markdown
markdownlint '**/*.md' --ignore node_modules --config .markdownlint.json

# Auto-fix
markdownlint '**/*.md' --ignore node_modules --config .markdownlint.json --fix
```

## Pre-Push Checklist

Before pushing code, run:

```bash
# 1. Browser Extension
cd browser-extension && npm run lint:fix && cd ..

# 2. Backend
cd backend && black . && isort . && flake8 . && cd ..

# 3. Markdown (optional)
markdownlint '**/*.md' --ignore node_modules --fix
```

## CI/CD Status

Check your PR on GitHub for automated linting results:
- ✅ ESLint (TypeScript/React)
- ✅ Python Linting (Flake8, Black, isort)
- ✅ Hadolint (Dockerfiles)
- ✅ yamllint (YAML)
- ✅ markdownlint (Markdown)

## Installing Tools

### JavaScript Tools
```bash
cd browser-extension
npm install
```

### Python Tools
```bash
pip install flake8 black isort yamllint
```

### Markdown Tools
```bash
npm install -g markdownlint-cli
```

## Common Issues

| Issue | Solution |
|-------|----------|
| `Module not found` | Run `npm install` in browser-extension/ |
| `flake8 not found` | Run `pip install flake8` |
| Formatting conflicts | Run `npm run lint:fix` or `black .` |
| Import order errors | Run `isort .` |
| Long lines | Break into multiple lines |

## Configuration Files

| File | Purpose |
|------|---------|
| `browser-extension/.eslintrc.json` | ESLint rules |
| `browser-extension/.eslintignore` | ESLint ignore patterns |
| `backend/.flake8` | Flake8 rules |
| `backend/pyproject.toml` | Black & isort rules |
| `.hadolint.yaml` | Dockerfile rules |
| `.yamllint.yaml` | YAML rules |
| `.markdownlint.json` | Markdown rules |

## Need Help?

📖 **Full Documentation**: See `LINTING.md`
🔧 **Setup Guide**: See `.github/LINTING_SETUP.md`
❓ **Questions**: Open an issue on GitHub
