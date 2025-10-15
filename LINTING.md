# Linting Guide for Canner

This document describes the linting setup and guidelines for the Canner project. All code contributions must pass linting checks before being merged.

## Table of Contents

- [Overview](#overview)
- [Automated CI/CD Checks](#automated-cicd-checks)
- [Local Development Setup](#local-development-setup)
- [Linting Tools](#linting-tools)
- [Running Lints Locally](#running-lints-locally)
- [Auto-Fixing Issues](#auto-fixing-issues)
- [Pre-commit Hooks (Optional)](#pre-commit-hooks-optional)
- [Troubleshooting](#troubleshooting)

## Overview

The Canner project uses multiple linting tools to maintain code quality and consistency:

- **ESLint** - JavaScript/TypeScript linting for the browser extension
- **Flake8** - Python style guide enforcement for the backend
- **Black** - Python code formatter
- **isort** - Python import statement organizer
- **Hadolint** - Dockerfile linting
- **yamllint** - YAML file linting
- **markdownlint** - Markdown documentation linting

## Automated CI/CD Checks

All pull requests and pushes to the `main` or `develop` branches automatically trigger linting checks via GitHub Actions.

The workflow (`.github/workflows/lint.yml`) includes:

- ✅ ESLint checks on TypeScript/React code
- ✅ Python linting (Flake8, Black, isort)
- ✅ Dockerfile linting (Hadolint)
- ✅ YAML linting (yamllint)
- ✅ Markdown linting (markdownlint)

**All checks must pass** before code can be merged.

## Local Development Setup

### Browser Extension (JavaScript/TypeScript)

```bash
cd browser-extension
npm install
```

This installs ESLint and all required plugins.

### Backend (Python)

```bash
cd backend
pip install flake8 black isort
```

Or install from requirements:

```bash
pip install -r requirements.txt
pip install flake8 black isort  # Development dependencies
```

### Additional Tools

```bash
# Install yamllint (Python)
pip install yamllint

# Install markdownlint (Node.js)
npm install -g markdownlint-cli

# Hadolint (Docker)
# Install from: https://github.com/hadolint/hadolint#install
# Or use Docker: docker pull hadolint/hadolint
```

## Linting Tools

### 1. ESLint (TypeScript/React)

**Configuration**: `browser-extension/.eslintrc.json`

Rules:
- TypeScript strict mode
- React and React Hooks best practices
- 2-space indentation
- Double quotes for strings
- Semicolons required
- No unused variables (with exceptions for `_` prefixed)

### 2. Flake8 (Python Style)

**Configuration**: `backend/.flake8`

Rules:
- Max line length: 100 characters
- Complexity limit: 10
- Excludes: venv, __pycache__, dist, build

### 3. Black (Python Formatter)

**Configuration**: `backend/pyproject.toml`

Rules:
- Line length: 100 characters
- Python 3.12 target
- Automatic code formatting

### 4. isort (Python Imports)

**Configuration**: `backend/pyproject.toml`

Rules:
- Compatible with Black
- Line length: 100 characters
- Automatic import sorting

### 5. Hadolint (Dockerfile)

**Configuration**: `.hadolint.yaml`

Rules:
- Best practices for Docker images
- Security checks
- Layer optimization hints

### 6. yamllint (YAML Files)

**Configuration**: `.yamllint.yaml`

Rules:
- Max line length: 120 characters
- 2-space indentation
- Consistent formatting

### 7. markdownlint (Markdown)

**Configuration**: `.markdownlint.json`

Rules:
- Max line length: 120 characters (except tables/code)
- ATX-style headers
- Consistent list formatting

## Running Lints Locally

### JavaScript/TypeScript (Browser Extension)

```bash
cd browser-extension

# Run ESLint
npm run lint

# Run ESLint with auto-fix
npm run lint:fix

# Run ESLint with zero warnings (CI mode)
npm run lint:check
```

### Python (Backend)

```bash
cd backend

# Run Flake8
flake8 . --config=.flake8

# Check Black formatting (no changes)
black --check --diff .

# Apply Black formatting
black .

# Check isort (no changes)
isort --check-only --diff .

# Apply isort
isort .

# Run all Python lints
flake8 . && black --check . && isort --check-only .
```

### Dockerfile

```bash
# Using Hadolint directly
hadolint backend/Dockerfile

# Using Docker
docker run --rm -i hadolint/hadolint < backend/Dockerfile
```

### YAML

```bash
# Lint all YAML files
yamllint -c .yamllint.yaml .github/workflows/*.yml docker-compose.yml
```

### Markdown

```bash
# Lint all Markdown files
markdownlint '**/*.md' --ignore node_modules --config .markdownlint.json

# Fix auto-fixable issues
markdownlint '**/*.md' --ignore node_modules --config .markdownlint.json --fix
```

## Auto-Fixing Issues

Many linting issues can be automatically fixed:

### TypeScript/JavaScript

```bash
cd browser-extension
npm run lint:fix
```

### Python

```bash
cd backend
black .
isort .
```

### Markdown

```bash
markdownlint '**/*.md' --ignore node_modules --fix
```

## Pre-commit Hooks (Optional)

To automatically run lints before committing, you can set up pre-commit hooks:

### Using Husky (JavaScript)

```bash
cd browser-extension
npm install --save-dev husky lint-staged
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "cd browser-extension && npm run lint:check"
```

### Using pre-commit (Python)

Create `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 23.12.1
    hooks:
      - id: black
        language_version: python3.12

  - repo: https://github.com/pycqa/isort
    rev: 5.13.2
    hooks:
      - id: isort

  - repo: https://github.com/pycqa/flake8
    rev: 7.0.0
    hooks:
      - id: flake8
```

Install and activate:

```bash
pip install pre-commit
pre-commit install
```

## Troubleshooting

### ESLint Issues

**Problem**: `Cannot find module 'eslint-plugin-react'`

**Solution**:

```bash
cd browser-extension
npm install
```

**Problem**: TypeScript parsing errors

**Solution**: Ensure `tsconfig.json` is properly configured and all TypeScript files are valid.

### Python Issues

**Problem**: Black and Flake8 conflicts

**Solution**: Our configurations are compatible. If you see conflicts, ensure you're using the latest versions.

**Problem**: Import order issues

**Solution**: Run `isort .` to automatically fix import ordering.

### Hadolint Issues

**Problem**: DL3008 warnings about apt-get

**Solution**: These are ignored in our configuration. If needed, pin package versions in Dockerfiles.

### YAML Issues

**Problem**: Line too long errors

**Solution**: Break long lines or adjust `.yamllint.yaml` if necessary.

### Markdown Issues

**Problem**: MD013 line length errors

**Solution**: Break long lines. Code blocks and tables are exempt from this rule.

## CI/CD Workflow Details

The GitHub Actions workflow runs on:

- **Push to main/develop**: All linting checks
- **Pull requests**: All linting checks

Jobs run in parallel for faster feedback:

1. `eslint` - Browser extension linting
2. `python-lint` - Backend linting (Flake8, Black, isort)
3. `hadolint` - Dockerfile linting
4. `yamllint` - YAML file linting
5. `markdownlint` - Markdown documentation linting
6. `lint-summary` - Aggregate results from all jobs

If any job fails, the entire workflow fails, preventing merge.

## Best Practices

1. **Run lints locally** before pushing code
2. **Use auto-fix** commands to quickly resolve formatting issues
3. **Address warnings** - don't just ignore them
4. **Keep configurations up to date** with the project standards
5. **Document exceptions** - if you need to disable a rule, explain why

## Configuration Files Reference

```
canner/
├── .github/
│   └── workflows/
│       └── lint.yml                    # CI/CD workflow
├── browser-extension/
│   ├── .eslintrc.json                  # ESLint config
│   └── package.json                    # NPM scripts
├── backend/
│   ├── .flake8                         # Flake8 config
│   └── pyproject.toml                  # Black & isort config
├── .hadolint.yaml                      # Hadolint config
├── .yamllint.yaml                      # yamllint config
├── .markdownlint.json                  # markdownlint config
└── LINTING.md                          # This file
```

## Contributing

When contributing to Canner:

1. Ensure your code passes all linting checks locally
2. Fix any issues reported by the CI/CD pipeline
3. Follow the established code style and conventions
4. Update this document if you make changes to linting configurations

---

**Questions?** Open an issue or reach out to the maintainers!
