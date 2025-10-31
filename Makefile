.PHONY: help lint lint-all lint-frontend lint-backend lint-configs venv fix-backend fix-frontend fix-configs fix-all

# Python virtual environment
VENV = .venv
PYTHON = $(VENV)/bin/python3
PIP = $(VENV)/bin/pip

# Default target
help:
	@echo "🔍 Canner Linting Makefile"
	@echo ""
	@echo "Requirements:"
	@echo "  - Python 3 (python3 command available)"
	@echo "  - Node.js (npm command available)"
	@echo "  - Docker (optional, for Dockerfile linting)"
	@echo ""
	@echo "Available targets:"
	@echo "  make build         - Build the browser extension"
	@echo "  make lint-all       - Run all linting checks (frontend + backend + configs)"
	@echo "  make lint-frontend  - Lint TypeScript/JavaScript code"
	@echo "  make lint-backend   - Lint Python code (flake8, black, isort)"
	@echo "  make lint-configs   - Lint configuration files (YAML, Markdown, Dockerfiles)"
	@echo "  make fix-frontend   - Auto-fix frontend code (ESLint --fix)"
	@echo "  make fix-backend    - Auto-fix backend code formatting (black + isort)"
	@echo "  make fix-configs    - Auto-fix config files (trailing spaces, newlines)"
	@echo "  make fix-all        - Auto-fix all fixable issues (frontend + backend + configs)"
	@echo ""



# Alias for building the extension 
build:
	cd "$(dir $(abspath $(lastword $(MAKEFILE_LIST))))browser-extension" && npm run build

# Alias for convenience
lint: lint-all

# Run all linting checks
lint-all: lint-frontend lint-backend lint-configs
	@echo "✅ All linting checks completed!"

# Lint Frontend (TypeScript/JavaScript)
lint-frontend:
	@echo "📚 Install dependencies"
	cd browser-extension && npm ci
	@echo "🔍 Run ESLint"
	cd browser-extension && npm run lint

# Create Python virtual environment
venv:
	@if [ ! -d "$(VENV)" ]; then \
		echo "📦 Creating Python virtual environment..."; \
		python3 -m venv $(VENV); \
		echo "✅ Virtual environment created at $(VENV)"; \
	fi

# Lint Backend (Python)
lint-backend: venv
	@echo "📚 Install Python linting tools"
	$(PYTHON) -m pip install --upgrade pip
	$(PIP) install flake8 black isort
	@echo "🔍 Run flake8 (Style Guide Enforcement)"
	$(PYTHON) -m flake8 backend --count --select=E9,F63,F7,F82 --show-source --statistics
	$(PYTHON) -m flake8 backend --count --exit-zero --max-complexity=10 --max-line-length=88 --statistics
	@echo "🎨 Check code formatting with black"
	$(PYTHON) -m black --check --diff backend
	@echo "📦 Check import sorting with isort"
	$(PYTHON) -m isort --check-only --diff backend --skip-glob='*/myenv/*' --skip-glob='*/.venv/*'

# Lint Configuration Files
lint-configs: venv
	@echo "📚 Install linting tools"
	$(PYTHON) -m pip install yamllint
	@echo "⚙️  Lint YAML files"
	$(PYTHON) -m yamllint -c .yamllint.yml .github/ docker-compose.yml
	@echo "� Lint Markdown files"
	@echo "Skipping markdownlint (requires global install)"
	# npx markdownlint '**/*.md' --ignore node_modules --ignore .venv


# Auto-fix backend code formatting
fix-backend: venv
	@echo "🔧 Auto-fixing backend code with black..."
	$(PYTHON) -m black backend
	@echo "📦 Auto-fixing import sorting with isort..."
	$(PYTHON) -m isort backend
	@echo "✅ Backend auto-fixes applied! Run 'make lint-backend' to verify."

# Auto-fix frontend code formatting
fix-frontend:
	@echo "🔧 Auto-fixing frontend code with ESLint..."
	cd browser-extension && npm run lint -- --fix || true
	@echo "✅ Frontend auto-fixes applied! Run 'make lint-frontend' to verify remaining issues."

# Auto-fix configuration files (YAML, Markdown)
fix-configs:
	@echo "🔧 Auto-fixing YAML files..."
	@find . \( -name "*.yml" -o -name "*.yaml" \) -not -path "*/node_modules/*" -not -path "*/.venv/*" | while read file; do \
		echo "  Fixing $$file"; \
		sed -i 's/\r$$//' "$$file"; \
		sed -i 's/[[:space:]]*$$//' "$$file"; \
		sed -i -e '$$a\' "$$file"; \
	done
	@echo "✅ Config auto-fixes applied! Run 'make lint-configs' to verify."

# Auto-fix all fixable issues
fix-all: fix-frontend fix-backend fix-configs
	@echo "✅ All auto-fixes completed!"
