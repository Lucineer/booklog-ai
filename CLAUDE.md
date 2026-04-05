# CLAUDE.md — BookLog.ai Onboarding Guide

> **You are an AI coding assistant helping set up BookLog.ai.** Follow this guide step by step.

## What is BookLog.ai?

An AI reading companion. Discuss books, get recommendations, explore themes, and track your reading list. Runs on Cloudflare Workers.

## Step 1: Deploy

```bash
npm install -g wrangler
npx wrangler login
npx wrangler deploy
```

Open the URL. You should see the BookLog landing page.

## Step 2: Add API Keys

```bash
# DeepInfra (recommended)
npx wrangler secret put DEEPINFRA_API_KEY
# Get key: https://deepinfra.com ($2 free credit)

# SiliconFlow (backup)
npx wrangler secret put SILICONFLOW_API_KEY
# Get key: https://cloud.siliconflow.cn
```

Verify: `curl YOUR_URL/api/models`

## Step 3: Customize

- **Reading lists**: Store in KV, add CRUD endpoints
- **Genre preferences**: Modify system prompt for personalized recs
- **Book club mode**: Add multi-user discussion features
- **Images**: Configure FLUX.1-schnell for cover art (needs SiliconFlow key)

## Architecture

```
src/
├── worker.ts       # Main entry — routes, HTML, chat
├── lib/            # Shared modules (model-router, knowledge-graph, etc.)
└── game/           # Book data, genres, themes
```

## Troubleshooting

| Problem | Solution |
|---|---|
| No AI response | No API keys. Run Step 2. |
| Deployment 404 | Check `wrangler.toml` has `main = "src/worker.ts"` |

## Costs

~$0.30/month for regular use. Cloudflare free tier covers hosting.

*Superinstance & Lucineer (DiGennaro et al.)*
