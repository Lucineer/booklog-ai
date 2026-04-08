# CLAUDE.md — Booklog Ai

You are the specialist and shipwright for this vessel. Two roles, one agent.

## Identity
- **Vessel**: Booklog Ai
- **Role**: BookLog.ai
- **URL**: https://booklog-ai.casey-digennaro.workers.dev
- **Repo**: github.com/Lucineer/booklog-ai
- **Branch**: master
- **KV Namespace**: unknown
- **Size**: ~250 lines

## Specialist Mode — Day-to-Day Operations

### Deploy
```bash
cd /tmp/booklog-ai && wrangler deploy
```

### Health Check
```bash
curl -s https://booklog-ai.casey-digennaro.workers.dev/health
curl -s https://booklog-ai.casey-digennaro.workers.dev/vessel.json | python3 -m json.tool
```

### Key Endpoints
| Endpoint | What It Does |
|----------|-------------|
| /health | Liveness check |
| /vessel.json | Fleet self-description |

### Common Issues & Recovery
1. **502 error**: Check KV namespace `unknown`, redeploy with `rm -rf .wrangler dist && wrangler deploy`
2. **CSP blocking**: CSP pattern is `inline string in Response` — ensure connect-src includes needed domains
3. **Stale build**: `rm -rf .wrangler dist && wrangler deploy`
4. **GitHub raw cache**: Changes may take 5-10 min to propagate on raw.githubusercontent.com
5. **Git push conflict**: `git fetch && git reset --hard origin/master && re-apply changes`

### Fleet Connections
- **Emergence bus**: not wired
- **Vessel Tuner**: https://vessel-tuner.casey-digennaro.workers.dev/api/vessel?name=booklog-ai
- **Fleet grid**: Listed in cocapn.ai and the-fleet

## Shipwright Mode — Drydock Operations

### Architecture Pattern
- **Type**: Raw CF Worker
- **JSON helper**: Response() with headers
- **CSP pattern**: inline string in Response
- **Features.js**: no

### Fleet Patterns
- **Frame-ancestors in CSP**: yes
- **vessel.json capabilities**: chat, books
- **Fleet link footer**: yes

### Refactoring Rules
1. **NEVER** change the JSON helper function name (`Response() with headers`) — breaks all endpoints
2. **NEVER** add template literals (${var}) inside HTML strings — breaks esbuild
3. **NEVER** use single quotes inside double-quoted HTML inside single-quoted TS strings
4. **ALWAYS** use string concatenation for HTML, not template literals
5. **ALWAYS** test with `curl /health` after every change
6. **ALWAYS** check vessel-tuner score before and after refactoring
7. **PREFER** `/features.js` endpoint for complex client-side JS (avoids quote escaping)
8. **PREFER** `write` tool over heredocs — obfuscation detector blocks cat << EOF

### Before Refactoring Checklist
- [ ] Current vessel-tuner score recorded
- [ ] Git status clean (no uncommitted changes)
- [ ] Branch backed up (`git tag before-refactor`)
- [ ] All endpoints tested and working
- [ ] Fleet connections documented

### After Refactoring Checklist
- [ ] `curl /health` returns 200
- [ ] `curl /vessel.json` returns valid JSON with capabilities
- [ ] CSP header present with frame-ancestors
- [ ] Vessel-tuner score >= previous score
- [ ] Landing page renders correctly
- [ ] `git push` succeeds

## Captain's Standing Orders
1. Keep the vessel small. ~250 lines is the current size.
2. Zero runtime dependencies unless absolutely necessary.
3. Every endpoint must be useful — no dead code.
4. Equipment is loaded inline, never via npm.
5. All changes committed with descriptive messages.
6. If something breaks, fix it before moving on.
7. Document what you changed and why.

## Vessel Evolution
- **Current stage**: [hardware-first | safe | effective | pretty | optimized]
- **Target stage**: optimized
- **Rollback points**: check git log for last-known-good commits
