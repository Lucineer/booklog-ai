// src/worker.ts — BookLog AI Worker
// Part of the Cocapn ecosystem at cocapn.ai
import { loadBYOKConfig, callLLM, saveBYOKConfig, generateSetupHTML, type BYOKConfig, type LLMMessage } from './lib/byok.ts';
import { softActualize, confidenceScore } from './lib/soft-actualize.ts';

export interface Env {
  MEMORY: KVNamespace;
  AGENT_NAME?: string;
  AGENT_TONE?: string;
  AGENT_AVATAR?: string;
}

const AGENT_NAME = 'BookLog';
const DOMAIN = 'books';
const ITEM = 'book';
const SYSTEM_PROMPT = 'You are BookLog, a literary companion. Help users track their reading, discover new books, and reflect on what they've read. Discuss themes, suggest similar authors, and help maintain reading goals. Be thoughtful and insightful.';
const ACCENT = '#8b5cf6';

// ── Domain Data Layer ──

async function getItems(env: Env, userId: string): Promise<any[]> {
  const raw = await env.MEMORY.get(`${userId}:${DOMAIN}`, 'json');
  return Array.isArray(raw) ? raw : [];
}

async function saveItems(env: Env, userId: string, items: any[]): Promise<void> {
  await env.MEMORY.put(`${userId}:${DOMAIN}`, JSON.stringify(items));
}

async function getItem(env: Env, userId: string, id: string): Promise<any | null> {
  const items = await getItems(env, userId);
  return items.find((i: any) => i.id === id) || null;
}

async function createItem(env: Env, userId: string, data: any): Promise<any> {
  const items = await getItems(env, userId);
  const item = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...data };
  items.push(item);
  await saveItems(env, userId, items);
  return item;
}

async function updateItem(env: Env, userId: string, id: string, data: any): Promise<any | null> {
  const items = await getItems(env, userId);
  const idx = items.findIndex((i: any) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...data, updatedAt: new Date().toISOString() };
  await saveItems(env, userId, items);
  return items[idx];
}

async function deleteItem(env: Env, userId: string, id: string): Promise<boolean> {
  const items = await getItems(env, userId);
  const filtered = items.filter((i: any) => i.id !== id);
  if (filtered.length === items.length) return false;
  await saveItems(env, userId, filtered);
  return true;
}

// ── User Identity ──

async function getUserId(request: Request, env: Env): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') || 'anon';
  const fp = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const hash = Array.from(new Uint8Array(fp)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hash.slice(0, 16);
}

// ── HTML Generation ──

function generateLandingHTML(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${AGENT_NAME} — Cocapn</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a1a;color:#e0e0e0;font-family:system-ui,-apple-system,sans-serif;min-height:100vh}
header{padding:1.5rem 2rem;display:flex;align-items:center;gap:1rem;border-bottom:1px solid #1a1a2e}
.logo{font-size:1.5rem;color:${ACCENT}}
main{max-width:900px;margin:2rem auto;padding:0 1rem}
.chat-area{background:#111122;border:1px solid #1a1a2e;border-radius:12px;overflow:hidden}
.messages{height:60vh;overflow-y:auto;padding:1rem}
.msg{margin-bottom:1rem;padding:.75rem 1rem;border-radius:8px;max-width:80%}
.msg.user{background:#1a1a3e;margin-left:auto}
.msg.assistant{background:#1a2a1a}
.msg .role{font-size:.7rem;color:#888;text-transform:uppercase;margin-bottom:.25rem}
.input-area{display:flex;gap:.5rem;padding:1rem;border-top:1px solid #1a1a2e}
.input-area textarea{flex:1;background:#111122;border:1px solid #333;border-radius:8px;padding:.75rem;color:#e0e0e0;font-size:.95rem;resize:none;min-height:44px;max-height:120px}
.input-area textarea:focus{outline:none;border-color:${ACCENT}}
.input-area button{background:${ACCENT};color:#0a0a1a;border:none;border-radius:8px;padding:.75rem 1.5rem;font-weight:700;cursor:pointer}
.sidebar{position:fixed;right:0;top:0;width:280px;height:100vh;background:#0d0d1d;border-left:1px solid #1a1a2e;padding:1rem;overflow-y:auto}
.sidebar h3{color:${ACCENT};margin-bottom:.75rem;font-size:.9rem}
.item-card{background:#111122;border:1px solid #1a1a2e;border-radius:8px;padding:.75rem;margin-bottom:.5rem;cursor:pointer;font-size:.85rem}
.item-card:hover{border-color:${ACCENT}}
.empty-state{text-align:center;padding:3rem;color:#666}
.empty-state .icon{font-size:3rem;margin-bottom:1rem}
</style></head><body>
<header><span class="logo">${AGENT_NAME}</span><span style="color:#666;font-size:.85rem">Cocapn</span></header>
<main>
  <div class="chat-area">
    <div class="messages" id="messages">
      <div class="empty-state"><div class="icon">📚</div><p>Ask me anything about your books!</p></div>
    </div>
    <div class="input-area">
      <textarea id="input" placeholder="Type a message..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}"></textarea>
      <button onclick="send()">Send</button>
    </div>
  </div>
</main>
<script>
const msgs=[];
async function send(){
  const inp=document.getElementById('input');
  const text=inp.value.trim();if(!text)return;
  inp.value='';
  addMsg('user',text);
  const resp=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,history:msgs.slice(-10)})});
  const data=await resp.json();
  addMsg('assistant',data.reply||data.error||'No response');
}
function addMsg(role,content){
  msgs.push({role,content});
  const div=document.getElementById('messages');
  if(div.querySelector('.empty-state'))div.innerHTML='';
  const m=document.createElement('div');m.className='msg '+role;
  m.innerHTML='<div class="role">'+role+'</div><div>'+content.replace(/\n/g,'<br>')+'</div>';
  div.appendChild(m);div.scrollTop=div.scrollHeight;
}
</script></body></html>`;
}

// ── Seed Data ──

function getSeedData(): any[] {
  return [
    { id: crypto.randomUUID(), name: 'Sample Book', notes: 'Created by seed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];
}

// ── Routes ──

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health') {
      return Response.json({ status: 'ok', agent: AGENT_NAME, domain: DOMAIN, timestamp: new Date().toISOString() });
    }

    // Setup wizard
    if (path === '/setup') {
      return new Response(generateSetupHTML(AGENT_NAME, ACCENT), { headers: { 'Content-Type': 'text/html' } });
    }

    // Landing page
    if (path === '/' || path === '') {
      return new Response(generateLandingHTML(), { headers: { 'Content-Type': 'text/html' } });
    }

    // API routes
    if (path.startsWith('/api/')) {
      // Chat endpoint
      if (path === '/api/chat' && request.method === 'POST') {
        const config = await loadBYOKConfig(request, env);
        if (!config) return Response.json({ error: 'No LLM configured. Visit /setup to configure.' }, { status: 401 });

        const body = await request.json() as { message: string; history?: any[] };
        const userId = await getUserId(request, env);
        const items = await getItems(env, userId);
        const contextSummary = items.length > 0
          ? `User has ${items.length}  entries. Latest: ${JSON.stringify(items.slice(-3))}`
          : 'No books data yet.';

        const messages: LLMMessage[] = [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\nUser context: ${contextSummary}\nRespond in markdown when helpful. Be concise.` },
          ...(body.history || []).map((m: any) => ({ role: m.role, content: m.content })),
          { role: 'user', content: body.message },
        ];

        const llmResponse = await callLLM(config, messages);
        // Extract text from response
        const respData = await llmResponse.json();
        const reply = respData.choices?.[0]?.message?.content
          || respData.content?.[0]?.text
          || 'Unable to generate response.';

        return Response.json({ reply, confidence: confidenceScore(body.message, items.length > 0, true) });
      }

      // BYOK config save
      if (path === '/api/byok/config' && request.method === 'POST') {
        const config = await request.json() as BYOKConfig;
        await saveBYOKConfig(config, request, env);
        return Response.json({ ok: true });
      }

      // Seed endpoint
      if (path === '/api/seed' && request.method === 'POST') {
        const userId = await getUserId(request, env);
        const existing = await getItems(env, userId);
        if (existing.length > 0) {
          return Response.json({ message: 'Already seeded', count: existing.length });
        }
        const seed = getSeedData();
        await saveItems(env, userId, seed);
        return Response.json({ message: 'Seeded successfully', count: seed.length });
      }

      // Domain CRUD: GET /api/books
      if (path === `/api/${DOMAIN}` && request.method === 'GET') {
        const userId = await getUserId(request, env);
        const items = await getItems(env, userId);
        return Response.json({ : items, count: items.length });
      }

      // Domain CRUD: POST /api/books
      if (path === `/api/${DOMAIN}` && request.method === 'POST') {
        const userId = await getUserId(request, env);
        const data = await request.json();
        const item = await createItem(env, userId, data);
        return Response.json({ : item }, { status: 201 });
      }

      // Domain CRUD: GET /api/books/:id
      const domainMatch = path.match(`^/api/${DOMAIN}/([^/]+)$`);
      if (domainMatch) {
        const id = domainMatch[1];
        const userId = await getUserId(request, env);

        if (request.method === 'GET') {
          const item = await getItem(env, userId, id);
          return item ? Response.json({ : item }) : Response.json({ error: 'Not found' }, { status: 404 });
        }
        if (request.method === 'PATCH') {
          const data = await request.json();
          const item = await updateItem(env, userId, id, data);
          return item ? Response.json({ : item }) : Response.json({ error: 'Not found' }, { status: 404 });
        }
        if (request.method === 'DELETE') {
          const deleted = await deleteItem(env, userId, id);
          return deleted ? Response.json({ ok: true }) : Response.json({ error: 'Not found' }, { status: 404 });
        }
      }
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
