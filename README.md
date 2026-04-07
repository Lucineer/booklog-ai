<p align="center">
  <img src="https://raw.githubusercontent.com/Lucineer/capitaine/master/docs/capitaine-logo.jpg" alt="Capitaine" width="120">
</p>

<h1 align="center">booklog-ai</h1>

<p align="center">A personal reading log with local AI context.</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#limitations">Limitations</a> ·
  <a href="https://github.com/Lucineer/booklog-ai/issues">Issues</a>
</p>

---

You close a book, there's a line that sticks with you. You might write it down, or you might not. Weeks later, you wish you could find it again.

booklog-ai runs in your own fork and tracks your reading progress and notes. It uses local AI models to help you search and connect ideas from your reading history. It doesn't collect your data or show ads.

**Attribution: Superinstance & Lucineer (DiGennaro et al.)**

This is a cocapn vessel—a self-contained repository that runs on Cloudflare Workers and uses git for coordination.

---

## Quick Start

Fork this repository to your own account.

```bash
gh repo fork Lucineer/booklog-ai --clone
cd booklog-ai
npx wrangler login
echo "your-github-token" | npx wrangler secret put GITHUB_TOKEN
echo "your-llm-key" | npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```

Your instance will be live at your Worker URL.

## Features

### Reading Tools
- Track reading progress
- Collect and tag quotes
- Set personal reading goals
- Search your notes and highlights
- Export your log as markdown

### Platform
- **BYOK v2** – All secrets stored via Cloudflare Secrets
- Supports multiple LLM backends (DeepSeek, SiliconFlow, etc.)
- Persistent session context
- Built-in rate limiting
- Health monitoring

## Limitations

This is a single-file Worker with minimal dependencies. Its AI capabilities are limited by the model you configure and your API key's quotas. It does not have a graphical interface; you interact with it via API calls or a simple frontend you build yourself.

## Architecture

Single-file Cloudflare Worker with zero runtime dependencies. Built with [Capitaine](https://github.com/Lucineer/capitaine) and follows the [Cocapn Fleet Protocol](https://github.com/Lucineer/cocapn). It uses the CRP-39 protocol for fleet coordination.

---

<div align="center">
  <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> ·
  <a href="https://cocapn.ai">Cocapn</a>
</div>