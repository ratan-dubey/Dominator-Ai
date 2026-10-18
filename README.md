# Dominator AI

> **A modern, web-based AI chat platform with configurable model providers**

## Live Demo

Try the application live: [https://dominator--ai.web.app/](https://dominator--ai.web.app/)

## Project Overview

Dominator AI is a personal web-based AI chat platform that demonstrates how to build a responsive, authentication-protected UI with real-time streaming of AI responses. It supports multiple AI model providers (OpenAI-compatible, Google Gemini, etc.) and stores conversation history per user.

## Features

- Authentication-guarded chat (Firebase Authentication)
- Multi-provider AI engine
- Real-time token streaming (SSE) with Markdown, KaTeX, and syntax highlighting
- Conversation persistence in Firestore
- Responsive UI with dark/light/system theme
- Role-based admin panel (restricted access)

## Technology Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (ES modules)
- **Authentication & Database**: Firebase Authentication & Firestore
- **Hosting**: Firebase Hosting
- **Edge Backend**: Cloudflare Workers (proxy to AI providers)

## Architecture Overview

The application consists of three high-level components:
1. **Browser client** � static web UI that handles user interaction and streams responses.
2. **Firebase services** � authentication and storage of chat history.
3. **Cloudflare Worker** � secure edge backend that forwards requests to AI providers and streams responses.

## Project Status & Limitations

- Core chat, authentication, and streaming work fully.
- Provider configuration UI is available for set-up providers only.
- No payment, subscription, or file-upload features are implemented.
- Deployment scripts and secret management are intentionally omitted from this showcase repository.

## Repository Scope

This repository contains only the README/showcase documentation for Dominator AI and does **not** include the applications source code, UI assets, or configuration examples.

## Future Improvements

- Expand provider plug-in support
- Enhance role-based access controls and audit logging
- Add unit and integration test suites
- Provide a more detailed developer guide

## Author

- **GitHub**: https://github.com/ratan-dubey
- **Portfolio**: https://ratan-portfolio.web.app/
- **LinkedIn**: https://www.linkedin.com/in/ratan-dubey

## License

No open-source license is provided for this showcase repository. Reuse or redistribution is not granted by an explicit open-source license.
