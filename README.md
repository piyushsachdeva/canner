# CannerAI - AI-Powered LinkedIn & Twitter Assistant

> 🚀 A sophisticated browser extension and backend system that enhances your social media productivity with AI-powered response suggestions and seamless content management.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg)](https://python.org)

---

## ✨ Features
- Select from a variety of pre-defined response templates
- Format linkedin post with ease
- AI-powered content suggestions for personalized responses  
- Cross-platform compatibility for LinkedIn and Twitter 

---

## 🧠 Tech Stack

**Frontend:** TypeScript, React  
**Backend:** Python (Flask)  
**Database:** PostgreSQL / SQLite  
**Tools & Infrastructure:** Docker, NGINX, GitHub Actions, REST APIs    

---

## ⚙️ Installation & Setup

Follow these steps to set up the project locally 👇

1. **Clone the repository**
   ```bash
   git clone https://github.com/CannerAI/CannerAI.git
   cd CannerAI

2. **Install dependencies**
    • For the backend:
        cd backend
        pip install -r requirements.txt

    • For the browser extension:
        cd ../browser-extension
        npm install

3. **Run the backend server**
    python app.py

4. **Load the browser extension**
    • Open Chrome or Edge
    • Go to chrome://extensions/
    • Enable Developer Mode
    • Click Load unpacked and select the browser-extension folder

---

## 🏗 Architecture

Here’s an overview of how **Canner** works internally:

The Canner system is designed with a clear client-server model, containerized for efficient deployment and scalability.

![Architecture Diagram](./docs/architecture-diagram.svg)

---

🔍 Overview
Canner consists of three main components — the Client (Browser Extension), Server (Flask API inside Docker), and Database Layer.

Here’s how they work together:

🧩 1. Client / Browser Extension
• Built using React App and integrated browser storage.
• Interacts directly with LinkedIn, where users can trigger AI-assisted content suggestions.
• Includes:
    • Popup Interface – The main UI for users to select and generate responses.
    • Welcome Page – The onboarding or landing view for new users.
• Sends HTTP requests (GET, POST, PUT, UPDATE, DELETE) to the backend through NGINX for processing.

⚙️ 2. Server (Flask + NGINX inside Docker)
• The backend is managed by a Flask Server, hosted in a Docker container behind NGINX.
• Flask API Endpoints:
    • api/responses
    • api/health
    • api/responses/<id>
• The server uses a Response Model containing:
    • id, title, content, tags, createdAt, updatedAt
• Handles Logs / Errors and uses environment variables such as:
    • PORT, Database_url, FLASK_DEBUG, FLASK_APP, SECRET_KEY
• Implements CORS for secure cross-origin communication.

🗄️ 3. Database Layer
• The backend supports two database configurations:
• Postgres (default) – runs on port 5432
• SQLite (response.db) – fallback option if Database_url is not defined
• PG Admin is used for database administration and runs on port 8080.

🔁 Flow Summary
1. The user interacts with LinkedIn through the browser extension.
2. The extension communicates with the Flask API (via NGINX) to request or store AI-generated responses.
3. The server processes the request, manages response data in the database, and returns results to the client.

---

## 🚧 Future Enhancements
• Add AI model customization for personalized tone and behavior
• Improve UI/UX for smoother LinkedIn and Twitter post editing
• Integrate analytics for engagement tracking
• Add multi-language support

---

## 📄 **Contributing**

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.
- Join our Discord community for discussions and support. [Join Discord](https://discord.com/invite/the-cloudops-community-1030513521122885642)

---

## 🚀 Quick Start
A detailed Quick Start is written in our [Contributing Guide](CONTRIBUTING.md). You can go through it for more details. 

---

## **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 **Support**

- 📧 **Email**: [baivab@techtutorialswithpiyush.com](mailto:baivab@techtutorialswithpiyush.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/piyushsachdeva/canner/issues)
- 💬 **Discord**: [Join our Discord](https://discord.com/invite/the-cloudops-community-1030513521122885642)

Made with ❤️ for developers who type the same things repeatedly
