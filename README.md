<p align="center">
  <img src="https://raw.githubusercontent.com/Lucineer/capitaine/master/docs/capitaine-logo.jpg" alt="Capitaine" width="120">
</p>

<h1 align="center">booklog-ai</h1>

<p align="center">Reading companion and book tracking vessel.</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#the-fleet">The Fleet</a> ·
  <a href="https://github.com/Lucineer/booklog-ai/issues">Issues</a>
</p>

---

**Powered by [Capitaine](https://github.com/Lucineer/capitaine) · [Cocapn](https://github.com/Lucineer/cocapn)**

The repo IS the agent. booklog-ai is a cocapn vessel — a self-improving repository that runs on Cloudflare Workers, thinks with LLMs, and coordinates with the fleet through git.

## Quick Start

```bash
# Fork and deploy
gh repo fork Lucineer/booklog-ai --clone
cd booklog-ai
npx wrangler login
echo "your-github-token" | npx wrangler secret put GITHUB_TOKEN
echo "your-llm-key" | npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```

That's it. The vessel is alive.

## Features

- **BYOK v2** — Zero keys in code. All API keys via Cloudflare Secrets Store.
- **Multi-model** — DeepSeek, SiliconFlow, DeepInfra, Moonshot, z.ai, local models.
- **Session memory** — Conversations persist and build context over time.
- **PII safety** — Automatic detection and dehydration of sensitive data.
- **Rate limiting** — Guest tokens per IP with configurable limits.
- **Health checks** — Standard `/health` endpoint on all vessels.
- **Fleet coordination** — CRP-39 protocol for trust, bonds, and events.

## Architecture

Single-file Cloudflare Worker. Zero runtime dependencies. Inline HTML serving.

```
src/
  worker.ts      # The hull — serves users, runs heartbeats
lib/
  byok.ts        # Multi-model routing (BYOK v2)
  ...
```

## The Fleet

booklog-ai is one of 40+ autonomous vessels in the Lucineer fleet. Each vessel is a different domain of one intelligence.


<details>
<summary><strong>⚓ The Fleet</strong></summary>

**Flagship vessels**

- [cocapn.ai](https://github.com/Lucineer/capitaine)
- [personallog.ai](https://github.com/Lucineer/personallog-ai)
- [businesslog.ai](https://github.com/Lucineer/businesslog-ai)
- [studylog.ai](https://github.com/Lucineer/studylog-ai)
- [makerlog.ai](https://github.com/Lucineer/makerlog-ai)
- [playerlog.ai](https://github.com/Lucineer/playerlog-ai)
- [dmlog.ai](https://github.com/Lucineer/dmlog-ai)
- [reallog.ai](https://github.com/Lucineer/reallog-ai)
- [deckboss.ai](https://github.com/Lucineer/deckboss-ai)

**Fleet services**

- [Fleet Catalog](https://github.com/Lucineer/capitaine/blob/master/docs/fleet/FLEET.md)
- [Git Agent (full)](https://github.com/Lucineer/git-agent)
- [Cocapn Lite (minimal)](https://github.com/Lucineer/cocapn-lite)
- [Fleet Orchestrator](https://github.com/Lucineer/fleet-orchestrator)
- [Dead Reckoning Engine](https://github.com/Lucineer/dead-reckoning-engine)
- [Dream Engine](https://github.com/Lucineer/dream-engine)
- [Seed UI (5 layers)](https://github.com/Lucineer/seed-ui)

**For power users**

- [Cocapn Lite (tabula rasa)](https://github.com/Lucineer/cocapn-lite)
- [Cocapn (core platform)](https://github.com/Lucineer/cocapn)
- [ZeroClaw (framework)](https://github.com/Lucineer/zeroclaw)

[View all 106 repos →](https://github.com/orgs/Lucineer/repositories)
[Fleet manifest →](https://github.com/Lucineer/capitaine/blob/master/docs/fleet/FLEET.md)

</details>


## Philosophy

> The repo is the agent. The agent is the repo. Intelligence crystallizes from fluid (LLM calls) to solid (code). The vessel becomes faster and cheaper as it becomes smarter.

- **Fork-first** — Power users fork and customize. Casual users visit the domain.
- **Pay-for-convenience** — We save you costs through bulk inference, not markups.
- **Git as coordination** — Agents compete via PRs, not chat.
- **Soft actualization** — Vessels evolve gently based on usage, not hard updates.

## License

MIT · Superinstance & Lucineer (DiGennaro et al.)
