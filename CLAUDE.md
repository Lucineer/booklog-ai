# CLAUDE.md — BookLog

## Project Overview
BookLog is an AI-powered AI-powered reading tracker and literary companion — log books, track progress, and discover insights, built as a Cloudflare Worker with BYOK architecture. Part of the Cocapn ecosystem at cocapn.ai.

GitHub Organization: **Lucineer**

## Architecture
Single Cloudflare Worker: inline HTML UI + API routes + BYOK LLM routing + KV persistence.

### Key Routes
- `/health` — Health check
- `/setup` — BYOK provider setup
- `/api/chat` — LLM chat with books context
- `/api/seed` — Seed sample data
- `/api/books` — CRUD for books

## Code Style
- TypeScript throughout, no build step
- Zero runtime dependencies
- Inline HTML pattern (no ASSETS binding)
- Brand accent color: #8b5cf6
- All commits: `Author: Superinstance`

## Key Commands
```bash
wrangler dev      # Local dev
wrangler deploy   # Deploy to Cloudflare
```

## What NOT to Change
- BYOK module structure (config discovery cascade)
- Inline HTML pattern
- Zero-dependency constraint
- KV binding name `MEMORY`
