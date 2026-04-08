# booklog-ai
You finish a book at 2am and scribble a note. Three months later, you cannot remember what it meant. This agent remembers.

**Live demo:** [booklog-ai.casey-digennaro.workers.dev](https://booklog-ai.casey-digennaro.workers.dev)

---

## Why This Exists
Every book leaves quiet marks on you. Public review sites and algorithms do not care about the specific line that stuck with you. This is built only for you. It exists to remember your reading, with you.

---

## What this is
Your autonomous reading companion, running on Cloudflare Workers. You fork it. You own it. No one else can see your notes, your half-finished thoughts, or the books you stopped reading. It tracks what you read, holds your quotes and notes, and builds recommendations from your history. No ads. No metrics.

---

## What Makes This Different
1.  You don't sign up. You fork it. There is no central server or account database.
2.  Recommendations are generated solely from patterns in your own reading history and notes.
3.  It does not send emails or notifications. It only responds when you ask it something.

---

## Quick Start
Fork this repository and run these commands to deploy your own private copy:

```bash
gh repo fork Lucineer/booklog-ai --clone && cd booklog-ai
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler deploy
```
Your agent will be live at the Worker URL printed after deployment. You can edit any file in `src/` or `lib/` to change its behavior.

---

## Features
- Log books, reading progress, and notes.
- Personal recommendations generated exclusively from your reading history.
- Reading goals that adjust based on your recent activity.
- Searchable collection of every quote you save.
- Maintains conversation context across sessions using Cloudflare KV.
- Cold start typically under 10ms, running on Cloudflare's edge network.
- Speaks the CRP-39 Fleet protocol for coordination with other Cocapn agents.

> **Limitation:** The agent currently only processes and generates text in English. It cannot analyze or respond in other languages.

---

## Core Details
- Zero runtime dependencies.
- All state stored in Cloudflare KV.
- Open source, MIT license.
- Fork-first deployment; you control your own instance and data.

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> &middot; <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>

---

<i>Built with [Cocapn](https://github.com/Lucineer/cocapn-ai) — the open-source agent runtime.</i>
<i>Part of the [Lucineer fleet](https://github.com/Lucineer)</i>

