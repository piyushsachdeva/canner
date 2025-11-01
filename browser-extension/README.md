# Canner Browser Extension

A browser extension that helps you quickly insert saved responses while typing on social media platforms like LinkedIn and Twitter.

## 🌟 Features

- 💬 **Quick Response Insertion** - Insert saved responses with a single click
- 🔍 **Smart Search** - Find responses by title, content, or tags
- 🎨 **Inline Suggestions** - See suggestions as you type
- 🌙 **Dark Mode** - Beautiful dark theme support
- 🔧 **Customizable** - Configure API URL and other settings
- 🚀 **Fast & Lightweight** - Minimal impact on browser performance

## 🏗️ Architecture

```
┌─────────────────────┐
│  VS Code Extension  │ ←→ Backend API
└─────────────────────┘
         ↑↓
┌─────────────────────┐
│    Flask Backend    │ ←→ PostgreSQL Database
│  (localhost:5000)   │
└─────────────────────┘
         ↑↓
┌─────────────────────┐
│ Browser Extension   │ ←→ LinkedIn.com
└─────────────────────┘
```

All three components share the same backend and database!

## 🎯 Use Cases

### Recruiters

- Save common interview questions and standard responses
- Quickly respond to candidate inquiries with personalized templates
- Maintain consistent communication across multiple platforms

### Sales Professionals

- Store product descriptions and pricing information
- Prepare objection handling responses
- Create follow-up templates for different stages of the sales process

### Customer Support

- Keep frequently asked questions and standard replies
- Maintain consistent responses across support channels
- Reduce response time with instant template insertion

### Content Creators

- Save content ideas and outlines
- Store commonly used phrases and hashtags
- Keep brand voice consistent across platforms

## 🚀 Quick Start

### Prerequisites

1. **Chrome/Edge Browser** (Manifest V3 required)
2. **Backend Server** (see [Backend Setup](../backend/README.md))
3. **PostgreSQL Database** (configured via backend)

### Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/your-username/canner.git
   cd canner/browser-extension
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Build the Extension:**

   ```bash
   npm run build
   ```

4. **Load in Browser:**
   - Open Chrome/Edge and navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist` folder in `canner/browser-extension`

### Development

```bash
# Development build with watch mode
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## 🛠️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Backend API URL
API_URL=http://localhost:5000
```

### Extension Settings

Access extension settings via the popup menu:

- **API URL** - Backend server address
- **Theme** - Light/Dark mode preference
- **Auto-show Button** - Automatically show helper button

## 📁 Project Structure

```
browser-extension/
├── src/
│   ├── background/     # Service worker (event handling)
│   ├── content/        # Content scripts (UI injection)
│   ├── popup/          # Popup UI (React)
│   ├── utils/          # Utility functions
│   └── welcome/        # Welcome page
├── public/             # Static assets
├── dist/               # Build output
├── webpack.config.js   # Build configuration
└── package.json        # Dependencies and scripts
```

## 🔌 API Integration

The extension communicates with the backend API for:

- **Authentication** - OAuth with Google/GitHub
- **Response Management** - CRUD operations for saved responses
- **User Profiles** - Topic-based organization
- **Sync** - Automatic data synchronization

### Key Endpoints

```
GET  /api/auth/user      # Get current user
GET  /api/responses      # Get all responses
POST /api/responses      # Create new response
PUT  /api/responses/:id  # Update response
```

## 🎨 UI Components

### Popup Interface

- **Search Bar** - Filter responses in real-time
- **Response List** - Scrollable list with tags
- **Theme Toggle** - Switch between light/dark modes
- **Settings Panel** - Configure extension behavior

### Content Scripts

- **Helper Button** - Floating pen icon near input fields
- **Inline Suggestions** - Ghost text suggestions while typing
- **Quick Response Menu** - Context menu for response insertion

## 🔒 Security

- **CSP Compliance** - Strict Content Security Policy
- **OAuth Integration** - Secure authentication flow
- **HTTPS Only** - All API communication over HTTPS
- **No Data Storage** - Sensitive data handled by backend

## 🧪 Testing

### Unit Tests

```bash
npm run test:unit
```

### Integration Tests

```bash
npm run test:integration
```

### End-to-End Tests

```bash
npm run test:e2e
```

## 🐛 Troubleshooting

### Extension Not Loading

1. Check that you selected the `dist` folder when loading unpacked
2. Verify there are no build errors in the console
3. Ensure all dependencies are installed (`npm install`)

### API Connection Issues

1. Confirm backend server is running (`npm run dev` in backend directory)
2. Check API URL in extension settings
3. Verify network connectivity and firewall settings

### Missing Helper Button

1. The extension only works on specific social media sites
2. Refresh the page after installation
3. Check that the site has editable text fields

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

### Code Style

- Follow existing code patterns
- Use TypeScript for type safety
- Write unit tests for new functionality
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI Library
- [Webpack](https://webpack.js.org/) - Module Bundler
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript
- [Flask](https://flask.palletsprojects.com/) - Backend Framework
