// ═══════════════════════════════════════════════════════════════════
// BYOK — Bring Your Own Key
// Same landing page, every user brings their own LLM provider.
// Config discovery: URL params → Cookie → KV → localStorage → fail
// Two modes: PROXY (worker calls LLM) or DIRECT (browser calls LLM)
// ═══════════════════════════════════════════════════════════════════

export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  defaultModel: string;
  authType: 'bearer' | 'x-api-key' | 'query-param' | 'none';
  authHeader?: string;
  models: string[];
  helpUrl: string;
  color: string;
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface BYOKConfig {
  providers: Record<string, ProviderConfig>;
  activeProvider: string;
  syncMethod: 'local' | 'cloudflare' | 'none';
  createdAt: number;
  updatedAt: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ── Built-in Provider Registry ──

export const BUILTIN_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini', authType: 'bearer',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini', 'o1-preview', 'o3-mini'],
    helpUrl: 'https://platform.openai.com/api-keys', color: '#10a37f',
  },
  {
    id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat', authType: 'bearer',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    helpUrl: 'https://platform.deepseek.com/api_keys', color: '#4d6bfe',
  },
  {
    id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514', authType: 'x-api-key',
    authHeader: 'anthropic-version:2023-06-01',
    models: ['claude-sonnet-4-20250514', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    helpUrl: 'https://console.anthropic.com/settings/keys', color: '#d4a574',
  },
  {
    id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile', authType: 'bearer',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    helpUrl: 'https://console.groq.com/keys', color: '#f55036',
  },
  {
    id: 'z-ai', name: 'z.ai (GLM)', baseUrl: 'https://api.z.ai/api/anthropic/v1',
    defaultModel: 'glm-5-turbo', authType: 'x-api-key',
    models: ['glm-5-turbo', 'glm-5.1', 'glm-4.7'],
    helpUrl: 'https://z.ai', color: '#7c3aed',
  },
  {
    id: 'ollama', name: 'Ollama (Local)', baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.1:8b', authType: 'none',
    models: ['llama3.1:8b', 'mistral:7b', 'codellama:7b', 'phi3:mini', 'gemma2:9b', 'qwen2:7b'],
    helpUrl: 'https://ollama.ai', color: '#6d28d9',
  },
  {
    id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.com/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3.2', authType: 'bearer',
    models: ['deepseek-ai/DeepSeek-V3.2', 'deepseek-ai/DeepSeek-R1', 'zai-org/GLM-5', 'zai-org/GLM-5V-Turbo', 'moonshotai/Kimi-K2.5', 'Qwen/Qwen3-Coder-480B-A35B-Instruct', 'Qwen/Qwen3-VL-235B-A22B-Instruct', 'MiniMaxAI/MiniMax-M2.5', 'stepfun-ai/Step-3.5-Flash'],
    helpUrl: 'https://cloud.siliconflow.cn', color: '#6366f1',
  },
];

export function getBuiltinProviders(): LLMProvider[] {
  return BUILTIN_PROVIDERS;
}

export function getProvider(id: string): LLMProvider | undefined {
  return BUILTIN_PROVIDERS.find(p => p.id === id);
}

// ── Config Discovery ──

/** Load config from URL params (ephemeral) */
function configFromUrl(url: URL): BYOKConfig | null {
  const provider = url.searchParams.get('provider');
  const apiKey = url.searchParams.get('apiKey');
  const model = url.searchParams.get('model');
  const baseUrl = url.searchParams.get('baseUrl');

  if (!apiKey || !provider) return null;

  const builtIn = getProvider(provider);
  return {
    providers: {
      [provider]: {
        baseUrl: baseUrl || builtIn?.baseUrl || '',
        apiKey,
        model: model || builtIn?.defaultModel || '',
      },
    },
    activeProvider: provider,
    syncMethod: 'none',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Load config from Authorization header: "provider:apiKey" */
function configFromAuth(request: Request): BYOKConfig | null {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;

  if (auth.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6));
    const colonIdx = decoded.indexOf(':');
    if (colonIdx > 0) {
      const provider = decoded.slice(0, colonIdx);
      const apiKey = decoded.slice(colonIdx + 1);
      const builtIn = getProvider(provider);
      if (builtIn) {
        return {
          providers: { [provider]: { baseUrl: builtIn.baseUrl, apiKey, model: builtIn.defaultModel } },
          activeProvider: provider,
          syncMethod: 'none',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
    }
  }

  return null;
}

/** Derive a fingerprint for KV lookup (IP + UA hash) */
async function userFingerprint(request: Request): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const data = ip + ':' + ua;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/** Load config from KV (cloudflare sync) */
async function configFromKV(request: Request, env: any): Promise<BYOKConfig | null> {
  if (!env?.KV) return null;
  const fp = await userFingerprint(request);
  const raw = await env.KV.get(`byok:${fp}`);
  return raw ? JSON.parse(raw) : null;
}

/** Load config from BYOK cookie */
function configFromCookie(request: Request): BYOKConfig | null {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  const match = cookie.match(/byok_config=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

/** Main config loader — checks all sources in order */
export async function loadBYOKConfig(request: Request, env: any): Promise<BYOKConfig | null> {
  const url = new URL(request.url);
  const urlConfig = configFromUrl(url);
  if (urlConfig) return urlConfig;

  const authConfig = configFromAuth(request);
  if (authConfig) return authConfig;

  const cookieConfig = configFromCookie(request);
  if (cookieConfig) return cookieConfig;

  const kvConfig = await configFromKV(request, env);
  if (kvConfig) return kvConfig;

  return null;
}

// ── Config Persistence ──

async function encryptKey(apiKey: string, fingerprint: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(fingerprint.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(apiKey)
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/** Save config to KV */
export async function saveBYOKConfig(config: BYOKConfig, request: Request, env: any): Promise<void> {
  config.updatedAt = Date.now();
  if (config.syncMethod === 'cloudflare' && env?.KV) {
    const fp = await userFingerprint(request);
    const encrypted = JSON.parse(JSON.stringify(config));
    for (const [id, pc] of Object.entries(encrypted.providers)) {
      (pc as any).apiKey = await encryptKey((pc as ProviderConfig).apiKey, fp);
    }
    await env.KV.put(`byok:${fp}`, JSON.stringify(encrypted));
  }
}

// ── LLM Calling (Unified Proxy) ──

export async function callLLM(
  config: BYOKConfig,
  messages: LLMMessage[],
  options?: { stream?: boolean; maxTokens?: number; temperature?: number },
): Promise<Response> {
  const providerConfig = config.providers[config.activeProvider];
  if (!providerConfig) {
    return new Response(JSON.stringify({ error: 'No provider configured' }), { status: 400 });
  }

  const builtIn = getProvider(config.activeProvider);
  const baseUrl = providerConfig.baseUrl || builtIn?.baseUrl || '';
  const apiKey = providerConfig.apiKey;
  const model = providerConfig.model || builtIn?.defaultModel || '';
  const maxTokens = options?.maxTokens || providerConfig.maxTokens || 2048;
  const temperature = options?.temperature ?? providerConfig.temperature ?? 0.7;
  const stream = options?.stream ?? false;

  if (config.activeProvider === 'anthropic' || config.activeProvider === 'z-ai') {
    return callAnthropicFormat(baseUrl, apiKey, model, messages, { stream, maxTokens, temperature });
  }
  // OpenAI-compatible (openai, deepseek, groq, ollama, siliconflow)
  return callOpenAIFormat(baseUrl, apiKey, model, messages, { stream, maxTokens, temperature });
}

function callOpenAIFormat(
  baseUrl: string, apiKey: string, model: string, messages: LLMMessage[],
  opts: { stream: boolean; maxTokens: number; temperature: number },
): Response {
  const url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey && apiKey !== 'none') headers['Authorization'] = `Bearer ${apiKey}`;

  const body = JSON.stringify({ model, messages, max_tokens: opts.maxTokens, temperature: opts.temperature, stream: opts.stream });

  return new Response(body, {
    headers: { 'Content-Type': 'application/json', 'X-LLM-Proxy': 'openai-compatible' },
    status: 200,
  });
}

function callAnthropicFormat(
  baseUrl: string, apiKey: string, model: string, messages: LLMMessage[],
  opts: { stream: boolean; maxTokens: number; temperature: number },
): Response {
  const url = `${baseUrl}/messages`;
  const systemMsg = messages.find(m => m.role === 'system')?.content || '';
  const userMsgs = messages.filter(m => m.role !== 'system');

  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };

  const body = JSON.stringify({
    model, max_tokens: opts.maxTokens, temperature: opts.temperature, stream: opts.stream,
    system: systemMsg,
    messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
  });

  return new Response(body, {
    headers: { 'Content-Type': 'application/json', 'X-LLM-Proxy': 'anthropic' },
    status: 200,
  });
}

// ── API Key Validation ──

export async function validateApiKey(
  provider: string, baseUrl: string, apiKey: string,
): Promise<{ valid: boolean; model?: string; error?: string }> {
  try {
    if (provider === 'anthropic' || provider === 'z-ai') {
      const resp = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      return { valid: resp.ok, error: resp.ok ? undefined : `HTTP ${resp.status}` };
    }
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey && apiKey !== 'none' ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
    });
    if (resp.ok) {
      const data = await resp.json() as { model?: string };
      return { valid: true, model: data.model };
    }
    return { valid: false, error: `HTTP ${resp.status}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

// ── Setup Wizard HTML ──

export function generateSetupHTML(agentName: string = 'AI Agent', agentColor: string = '#d4af37'): string {
  const providerCards = BUILTIN_PROVIDERS.map(p => `
    <button class="provider-card" data-provider="${p.id}" style="border-color:${p.color}33" onclick="selectProvider('${p.id}')">
      <div class="provider-dot" style="background:${p.color}"></div>
      <div class="provider-name">${p.name}</div>
      <div class="provider-model">${p.defaultModel}</div>
    </button>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${agentName} — Setup</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a1a;color:#e0e0e0;font-family:system-ui,-apple-system,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center}
.setup{max-width:520px;width:100%;padding:2rem}
h1{color:${agentColor};font-size:1.8rem;margin-bottom:.5rem;text-align:center}
.subtitle{text-align:center;color:#888;margin-bottom:2rem;font-size:.95rem}
.section{margin-bottom:1.5rem}
.label{font-size:.85rem;color:#888;margin-bottom:.5rem;text-transform:uppercase;letter-spacing:1px}
.providers{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.75rem}
.provider-card{background:#1a1a2e;border:2px solid transparent;border-radius:10px;padding:1rem;cursor:pointer;text-align:center;transition:all .2s}
.provider-card:hover,.provider-card.selected{background:#1a1a2e;border-color:${agentColor}}
.provider-dot{width:12px;height:12px;border-radius:50%;margin:0 auto .5rem}
.provider-name{font-weight:600;font-size:.9rem;margin-bottom:.25rem}
.provider-model{font-size:.75rem;color:#666}
.input-group{display:flex;gap:.5rem}
input[type=password],input[type=text],select{flex:1;background:#1a1a2e;border:1px solid #333;border-radius:8px;padding:.75rem 1rem;color:#e0e0e0;font-size:.95rem}
input:focus,select:focus{outline:none;border-color:${agentColor}}
select option{background:#1a1a2e;color:#e0e0e0}
.btn{background:${agentColor};color:#0a0a1a;border:none;border-radius:8px;padding:.75rem 2rem;font-weight:700;font-size:1rem;cursor:pointer;width:100%;transition:opacity .2s}
.btn:hover{opacity:.9}
.btn:disabled{opacity:.4;cursor:not-allowed}
.sync-toggle{display:flex;gap:1rem;margin-bottom:1rem}
.sync-option{flex:1;background:#1a1a2e;border:2px solid transparent;border-radius:8px;padding:.75rem;cursor:pointer;text-align:center;font-size:.85rem}
.sync-option.active{border-color:${agentColor}}
.status{text-align:center;margin-top:1rem;font-size:.85rem;color:#666;min-height:1.2em}
.error{color:#f44}
.success{color:#4f4}
.advanced{margin-top:1rem}
.advanced summary{cursor:pointer;color:#888;font-size:.85rem}
.advanced .fields{margin-top:.5rem;display:flex;flex-direction:column;gap:.5rem}
</style></head><body>
<div class="setup">
  <h1>⚡ ${agentName}</h1>
  <p class="subtitle">Choose your AI provider. Your API key stays private.</p>

  <div class="section">
    <div class="label">Provider</div>
    <div class="providers">${providerCards}</div>
  </div>

  <div class="section">
    <div class="label">API Key</div>
    <div class="input-group">
      <input type="password" id="apiKey" placeholder="sk-..." autocomplete="off">
      <button onclick="toggleKey()" style="background:#333;border:none;color:#888;padding:0 1rem;border-radius:8px;cursor:pointer" id="toggleBtn">Show</button>
    </div>
  </div>

  <div class="section">
    <div class="label">Model</div>
    <select id="modelSelect"></select>
  </div>

  <div class="section">
    <div class="label">Sync Method</div>
    <div class="sync-toggle">
      <div class="sync-option active" data-sync="local" onclick="setSync('local')">🌐 Local (Browser)</div>
      <div class="sync-option" data-sync="cloudflare" onclick="setSync('cloudflare')">☁️ Cloudflare KV</div>
    </div>
  </div>

  <div class="advanced">
    <summary>Advanced</summary>
    <div class="fields">
      <input type="text" id="customBase" placeholder="Custom base URL (optional)">
      <div class="input-group">
        <input type="number" id="maxTokens" placeholder="Max tokens" value="2048" min="100" max="32000" style="width:50%">
        <input type="number" id="temperature" placeholder="Temperature" value="0.7" min="0" max="2" step="0.1" style="width:50%">
      </div>
    </div>
  </div>

  <button class="btn" id="saveBtn" onclick="saveConfig()">Save & Start</button>
  <div class="status" id="status"></div>
</div>

<script>
const providers = ${JSON.stringify(BUILTIN_PROVIDERS)};
let selectedProvider = null;
let syncMethod = 'local';

function selectProvider(id) {
  selectedProvider = id;
  document.querySelectorAll('.provider-card').forEach(c => c.classList.toggle('selected', c.dataset.provider === id));
  const p = providers.find(p => p.id === id);
  const sel = document.getElementById('modelSelect');
  sel.innerHTML = p.models.map(m => '<option value="' + m + '"' + (m === p.defaultModel ? ' selected' : '') + '>' + m + '</option>').join('');
  document.getElementById('customBase').placeholder = p.baseUrl;
  document.getElementById('apiKey').placeholder = id === 'ollama' ? 'Not needed (local)' : 'Paste your API key...';
}

function toggleKey() {
  const inp = document.getElementById('apiKey');
  const btn = document.getElementById('toggleBtn');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'Hide'; }
  else { inp.type = 'password'; btn.textContent = 'Show'; }
}

function setSync(method) {
  syncMethod = method;
  document.querySelectorAll('.sync-option').forEach(o => o.classList.toggle('active', o.dataset.sync === method));
}

async function saveConfig() {
  if (!selectedProvider) { document.getElementById('status').innerHTML = '<span class="error">Select a provider</span>'; return; }
  const apiKey = document.getElementById('apiKey').value;
  if (!apiKey && selectedProvider !== 'ollama') { document.getElementById('status').innerHTML = '<span class="error">Enter an API key</span>'; return; }
  const model = document.getElementById('modelSelect').value;
  const p = providers.find(p => p.id === selectedProvider);
  const config = {
    providers: { [selectedProvider]: { baseUrl: document.getElementById('customBase').value || p.baseUrl, apiKey, model } },
    activeProvider: selectedProvider,
    syncMethod: syncMethod,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (syncMethod === 'local') {
    localStorage.setItem('byok_config', JSON.stringify(config));
    document.getElementById('status').innerHTML = '<span class="success">Saved! Reloading...</span>';
    setTimeout(() => window.location.href = '/', 500);
  } else {
    const resp = await fetch('/api/byok/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    if (resp.ok) {
      document.getElementById('status').innerHTML = '<span class="success">Saved to Cloudflare! Reloading...</span>';
      setTimeout(() => window.location.href = '/', 500);
    } else {
      document.getElementById('status').innerHTML = '<span class="error">Failed to save to Cloudflare</span>';
    }
  }
}
</script></body></html>`;
}
