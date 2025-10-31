# Contributing to Canner

We love your input! We want to make contributing to Canner as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## 📋 Requirements

Before you start contributing, ensure you have the following installed:

### Required

- **Docker** (v20.10+)

  - Required for running the full application stack
  - Download from [docker.com](https://www.docker.com/get-started)

- **Python** (v3.8+)

  - Required for backend development
  - Download from [python.org](https://www.python.org/downloads/)

- **Node.js** (v18+)

  - Required for browser extension development
  - Download from [nodejs.org](https://nodejs.org/)

- **Git**
  - Required for version control
  - Download from [git-scm.com](https://git-scm.com/)

### Recommended MUST

- **VS Code** - Recommended IDE with extensions for TypeScript and Python
- **Chrome/Firefox** - For testing the browser extension

## 🚀 Quick Start for Contributors

**Fork and clone the repository:**

```bash
git clone https://github.com/yourusername/canner.git
cd canner
```

### Building up Backend

1. **Set up the development environment:**

   ```bash
   - Using Dev Containers
     Press F1 then: Dev Containers: Rebuild and Reopen in Containers


   cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && python app.py
   ```

### Building up Frontend

```bash
cd browser-extension

# Install dependencies
sudo npm install

# Build for production
sudo npm run build

```

This creates a `dist/` folder with the compiled extension files:

```
dist/
├── background.js        # Background service worker
├── content.js          # Content script for LinkedIn
├── content.css         # Styles for injected UI
├── popup.html          # Extension popup interface
├── popup.js            # Popup React app
├── manifest.json       # Extension manifest
└── icons/              # Extension icons
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### Load Extension in Chrome

1. **Open Chrome Extensions page:**

   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode:**

   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension:**

   - Click "Load unpacked" button
   - Navigate to and select the `browser-extension/dist/` folder
   - Click "Select Folder"

4. **Verify Installation:**
   - Extension should appear in the extensions list
   - Look for "Canner" with version 1.0.0
   - Pin the extension to toolbar for easy access

### Load Extension in Firefox

1. **Open Firefox Add-ons Debug page:**

   ```
   about:debugging#/runtime/this-firefox
   ```

2. **Load Temporary Add-on:**

   - Click "Load Temporary Add-on" button
   - Navigate to `browser-extension/dist/` folder
   - Select the `manifest.json` file
   - Click "Open"

3. **Verify Installation:**
   - Extension should appear in the temporary extensions list
   - Check the browser toolbar for the extension icon


### Access pgAdmin & Configure Database

After building the frontend, you can access the database management interface:

1. **Open pgAdmin in Browser:**
   
   Navigate to: **http://localhost:8080**

2. **Login to pgAdmin:**
   
   - **Email:** `admin@canner.dev`
   - **Password:** `admin123`

3. **Register PostgreSQL Server:**
   
   a. Right-click **"Servers"** in the left sidebar
   
   b. Select **"Register" → "Server"**
   
   c. **General Tab:**
      - Name: `Canner Dev` (or any name you prefer)
   
   d. **Connection Tab:**
      - Host name/address: `postgres` ⚠️ **Important:** Use `postgres` (container name), not `localhost`
      - Port: `5432`
      - Maintenance database: `canner_dev`
      - Username: `developer`
      - Password: `devpassword`
      - ☑️ Check "Save password" (optional, for convenience)
   
   e. Click **"Save"**

4. **Browse the Database:**
   
   Once connected, expand the tree structure:
   ```
   Servers
     └─ Canner Dev
         └─ Databases
             └─ canner_dev
                 └─ Schemas
                     └─ public
                         └─ Tables
                             └─ responses
   ```

5. **Common Database Tasks:**
   
   - **View table data:** Right-click on `responses` → "View/Edit Data" → "All Rows"
   - **Run SQL queries:** Right-click on `canner_dev` → "Query Tool"
   - **Check table structure:** Expand `responses` → Click "Columns"

> **Tip:** If you can't connect, wait 10-20 seconds for PostgreSQL to fully initialize, then try again.

### Check Tables Using psql (Command Line)

Alternatively, you can use the PostgreSQL command-line tool to inspect the database:

1. **Connect to PostgreSQL:**
   
   ```bash
   # From inside the dev container or backend container
   psql -h postgres -U developer -d canner_dev
   
   # From your host machine
   psql -h localhost -p 5432 -U developer -d canner_dev
   ```
   
   When prompted, enter password: `devpassword`

2. **Useful psql Commands:**
   
   ```sql
   -- List all databases
   \l
   
   -- Connect to canner_dev database (if not already connected)
   \c canner_dev
   
   -- List all tables
   \dt
   
   -- Describe the responses table structure
   \d responses
   
   -- View all data in responses table
   SELECT * FROM responses;
   
   -- Count total responses
   SELECT COUNT(*) FROM responses;
   
   -- View recent responses (last 10)
   SELECT id, title, created_at FROM responses ORDER BY created_at DESC LIMIT 10;
   
   -- Search responses by title
   SELECT * FROM responses WHERE title LIKE '%example%';
   
   -- Exit psql
   \q
   ```

3. **Quick Database Health Check:**
   
   ```bash
   # Test database connection (one-liner)
   psql -h postgres -U developer -d canner_dev -c "SELECT COUNT(*) as total_responses FROM responses;"
   
   # View database version
   psql -h postgres -U developer -d canner_dev -c "SELECT version();"
   
   # Check if table exists
   psql -h postgres -U developer -d canner_dev -c "\dt responses"
   ```


### Test the Extension

1. **Navigate to LinkedIn:**

   ```
   https://www.linkedin.com/
   ```

2. **Test Features:**

   - Look for "💬 Quick Response" buttons on message boxes
   - Select any text to see the "+" save button appear
   - Press `Ctrl+Shift+L` in message boxes for quick access
   - Click extension icon to open the popup interface

3. **Check Console for Errors:**
   - Open DevTools (F12)
   - Check Console tab for any error messages
   - Look for "Canner: Content script loaded" message

## 🔄 GitHub Flow

We follow the GitHub Flow for contributions. Here's the proper workflow:

### 1. Fork the Repository

- **Go to the main repository** on GitHub
- **Click the "Fork" button** in the top-right corner
- **This creates your own copy** of the repository under your GitHub account

### 2. Clone Your Fork

- **Clone your forked repository** to your local machine
  ```bash
  git clone https://github.com/yourusername/canner.git
  cd canner
  ```
- **Add the original repository as upstream**
  ```bash
  git remote add upstream https://github.com/piyushsachdeva/canner.git
  ```

### 3. Create a Feature Branch

- **Create a new branch** from `main` for your feature or fix
  ```bash
  git checkout -b feature/your-feature-name
  ```
- Use descriptive branch names: `feature/add-emoji-support` or `fix/login-bug`

### 4. Make Your Changes

- **Edit files** and implement your feature or fix
- Keep commits small and focused
- Write clear, descriptive commit messages

### 5. Pull Latest Changes from Upstream

- **Before committing, sync with the original repository**
  ```bash
  git fetch upstream
  git pull upstream main
  ```
- **Resolve any merge conflicts** if they occur
- This ensures your changes are based on the latest code

### 6. Add and Commit Your Changes

- **Stage your changes**
  ```bash
  git add .
  ```
- **Commit with a descriptive message**
  ```bash
  git commit -m "feat: add emoji support to chat messages"
  ```

### 7. Push to Your Fork

- **Push your branch** to your forked repository
  ```bash
  git push origin feature/your-feature-name
  ```

### 8. Open a Pull Request

- **Go to your fork** on GitHub
- **Click "Compare & pull request"** button
- **Fill in the PR details using our template below**

When creating a pull request, please use the following template:

```markdown
### Description

Provide a clear and concise description of your changes.

### Summary of Changes

List the key changes made in this PR:

- Change 1
- Change 2

### Motivation and Context

Why is this change needed? What problem does it solve?

### Related Issues

Link any related issues using "Fixes #123" or "Related to #456"

### Type of Change

Check all that apply:

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update
- [ ] Code refactor
- [ ] Style update
- [ ] Test update

### Testing Instructions

Steps to test these changes:

1. First step
2. Second step
3. Third step

### Screenshots/Recordings

If applicable, add screenshots or recordings to demonstrate the changes.

### Contributor Checklist

- [ ] My code follows the project's coding style
- [ ] I have tested my changes thoroughly
- [ ] I have updated the documentation
- [ ] All tests are passing
- [ ] I have added/updated tests for my changes
- [ ] My changes generate no new warnings
```

When creating your PR, use this template to provide a clear and comprehensive overview of your changes. Not all sections may be relevant to every PR - feel free to omit those that don't apply.

### 9. Respond to Feedback

- **Review comments** from maintainers
- **Make requested changes** in your local branch
- **Commit and push updates** to the same branch
  ```bash
  git add .
  git commit -m "fix: address review feedback"
  git push origin feature/your-feature-name
  ```
- The PR will update automatically

### 10. After Merge

- **Pull the latest changes** to your local main branch
  ```bash
  git checkout main
  git pull upstream main
  ```
- **Delete your feature branch** (optional cleanup)
  ```bash
  git branch -d feature/your-feature-name
  git push origin --delete feature/your-feature-name
  ```

### Branch Naming Conventions

- `feature/` - New features (e.g., `feature/chat-history`)
- `fix/` - Bug fixes (e.g., `fix/message-encoding`)
- `docs/` - Documentation updates (e.g., `docs/api-reference`)
- `refactor/` - Code refactoring (e.g., `refactor/database-queries`)
- `test/` - Test additions or fixes (e.g., `test/api-endpoints`)




## 🐛 Bug Reports

### Good Bug Reports Include:

1. **Clear title** and description
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **Environment details** (OS, browser, version)
5. **Screenshots or videos** if applicable

## 💡 Feature Requests

### Good Feature Requests Include:

1. **Clear problem statement**
2. **Proposed solution**
3. **Alternative solutions considered**
4. **Use cases and examples**

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** and inclusive
- **Be constructive** in feedback
- **Help others** learn and contribute
- **Stay on topic** in discussions

## ✅ Do's and ❌ Don'ts

### ✅ Do's

- **Do** search existing issues before creating a new one
- **Do** provide detailed information in bug reports and feature requests
- **Do** test your changes thoroughly before submitting a PR
- **Do** follow the code style and conventions used in the project
- **Do** write clear commit messages that explain what and why
- **Do** update documentation when you change functionality
- **Do** be patient and respectful when waiting for reviews
- **Do** ask questions if you're unsure about something
- **Do** link related issues in your PRs
- **Do** keep PRs focused on a single feature or fix

### ❌ Don'ts

- **Don't** create duplicate issues without checking existing ones first
- **Don't** submit spam, low-effort, or placeholder issues/PRs
- **Don't** create issues like "Please assign me" or "+1" comments
- **Don't** make PRs with only whitespace or formatting changes without prior discussion
- **Don't** submit incomplete or untested code
- **Don't** create multiple issues for the same problem
- **Don't** hijack existing issues with unrelated topics
- **Don't** demand immediate responses or reviews
- **Don't** use offensive or inappropriate language
- **Don't** copy code without proper attribution
- **Don't** submit AI-generated PRs without understanding and testing the code

### Getting Help

- **Join Our Community**: [Discord](https://discord.com/invite/the-cloudops-community-1030513521122885642)
- 🐛 **Issues**: [GitHub Issues](https://github.com/piyushsachdeva/canner/issues)

## 📜 License

By contributing to Canner, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to Canner! 🎉
