# BOOKLOG-AI

> AI-powered reading tracker and literary companion — log books, track progress, and discover insights — part of the [Cocapn](https://cocapn.ai) ecosystem

![Build](https://img.shields.io/badge/build-passing-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-blue)

## Description

AI-powered reading tracker and literary companion — log books, track progress, and discover insights. Built as a Cloudflare Worker with BYOK (Bring Your Own Key) architecture.

## ✨ Features

Book logging and library management\n- Reading progress tracking\n- Reading goals and streaks\n- Genre and author analytics\n- Quote and note capture\n- Reading list management\n- Book recommendation engine

## 🚀 Getting Started

1. Clone the repo
2. `npm install`
3. `cp .dev.vars.example .dev.vars` and add your KV namespace ID
4. `npm run dev` to start locally
5. Visit `/setup` to configure your LLM provider

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/setup` | GET | BYOK setup wizard |
| `/api/chat` | POST | Chat with the AI agent |
| `/api/seed` | POST | Seed sample data |
| `/api/books` | GET | List all books |
| `/api/books` | POST | Create a book |
| `/api/books/:id` | GET | Get a book |
| `/api/books/:id` | PATCH | Update a book |
| `/api/books/:id` | DELETE | Delete a book |

## Architecture

Single Cloudflare Worker with inline HTML, BYOK LLM routing, and KV persistence. Zero runtime dependencies.

## License

MIT
