<p align="center">
  <img src="https://raw.githubusercontent.com/Lucineer/capitaine/master/docs/capitaine-logo.jpg" alt="Capitaine" width="120">
</p>

<h1 align="center">booklog-ai</h1>

<p align="center">Your quiet AI reading companion. No ads. No metrics. No one else's algorithm.</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#the-fleet">The Fleet</a> ·
  <a href="https://booklog-ai.casey-digennaro.workers.dev">Live Demo</a> ·
  <a href="https://github.com/Lucineer/booklog-ai/issues">Issues</a>
</p>

---

You finish a book at 2am. You scribble one line in a note. Three months later you cannot remember what it meant. You set a reading goal, and it immediately becomes another chore you fail at.

booklog-ai is a personal reading companion. It remembers the quotes you liked, the arguments you had with the author, the parts you skipped. It will never show you your reading streak. It will never post for you. It will never sell anything about what you read.

It is an autonomous agent running on Cloudflare Workers. You fork it. You own it. It is part of the Cocapn Fleet.

### What makes this different
Many book tools treat you as a data point. This one runs on your infrastructure.
- No account required on anyone else's server
- No telemetry. Nothing leaves your worker unless you say so.
- Recommendations come from your reading history, not a bestseller list.
- The repository is the agent. Every line of logic is in the code you run.

---

## Quick Start

Fork this repository, then run:
```bash
gh repo fork Lucineer/booklog-ai --clone && cd booklog-ai
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```
Your agent is now live at your worker URL.

## Features

- Track books, progress, marginalia and highlighted quotes
- Personalised recommendations built from your reading history
- Reading goals that adapt
- Full conversation memory across reading sessions
- All keys stay in Cloudflare Secrets
- Works with major LLMs
- Automatic PII detection and stripping
- Built in rate limiting and health checks
- Speaks CRP-39 Fleet protocol to coordinate with other agents
- Cold start under 10ms

**Limitation:** Currently, booklog-ai only processes text in English.

## Architecture

```
src/
  worker.ts      # Entrypoint, serves UI and handles requests
lib/
  byok.ts        # Multi-model routing
  memory.ts      # Session and long term reading context
  books.ts       # Metadata and library logic
```

## The Fleet

booklog-ai is one of 40+ purpose-built autonomous vessels in the Cocapn Fleet. Each vessel handles one domain, shares trust only with your other vessels, and never phones home.

<details>
<summary><strong>⚓ Full Fleet Listing</strong></summary>

**Flagship vessels**
- [cocapn.ai](https://github.com/Lucineer/capitaine)
- [personallog.ai](https://github.com/Lucineer/personallog)

**Learning & Development**
- [booklog-ai](https://github.com/Lucineer/booklog-ai)
- [research-ai](https://github.com/Lucineer/research-ai)
- [paperlog-ai](https://github.com/Lucineer/paperlog-ai)

**Knowledge & Memory**
- [index-ai](https://github.com/Lucineer/index-ai)
- [memory-ai](https://github.com/Lucineer/memory-ai)

**Media & Content**
- [videolog-ai](https://github.com/Lucineer/videolog-ai)
- [newsletter-ai](https://github.com/Lucineer/newsletter-ai)

**Development & Infrastructure**
- [sre-ai](https://github.com/Lucineer/sre-ai)
- [review-ai](https://github.com/Lucineer/review-ai)

**Communication**
- [mail-ai](https://github.com/Lucineer/mail-ai)
- [meeting-ai](https://github.com/Lucineer/meeting-ai)

**Health & Wellness**
- [foodlog-ai](https://github.com/Lucineer/foodlog-ai)
- [sleep-ai](https://github.com/Lucineer/sleep-ai)

**Finance & Organization**
- [expense-ai](https://github.com/Lucineer/expense-ai)
- [task-ai](https://github.com/Lucineer/task-ai)

[View all vessels...](https://the-fleet.casey-digennaro.workers.dev)
</details>

---

<div align="center">
  <sub>Part of the <a href="https://the-fleet.casey-digennaro.workers.dev">Cocapn Fleet</a> • <a href="https://cocapn.ai">Cocapn</a></sub><br>
  <sub>Attribution: Superinstance & Lucineer (DiGennaro et al.)</sub>
</div>