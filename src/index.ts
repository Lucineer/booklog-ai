import {
  BookLog,
  ReadingGoals,
  ReadingStatsCalculator,
  RecommendationEngine,
  QuoteCollector,
  loadState,
  AppState,
} from "./book/tracker";

export interface Env {
  DEEPSEEK_API_URL: string;
  DEEPSEEK_API_KEY: string;
  BOOKLOG_KV: KVNamespace;
}

// ── Persistence helpers ──────────────────────────────────────

const KV_KEY = "app-state";

async function getState(kv: KVNamespace): Promise<{
  bookLog: BookLog;
  goals: ReadingGoals;
  quotes: QuoteCollector;
}> {
  const raw = await kv.get(KV_KEY, "json");
  if (!raw) {
    const bookLog = new BookLog();
    return {
      bookLog,
      goals: new ReadingGoals(bookLog),
      quotes: new QuoteCollector(),
    };
  }
  return loadState(raw as AppState);
}

async function putState(
  kv: KVNamespace,
  bookLog: BookLog,
  goals: ReadingGoals,
  quotes: QuoteCollector
): Promise<void> {
  const state: AppState = {
    bookLog: bookLog.toJSON(),
    goals: goals.toJSON(),
    quotes: quotes.toJSON(),
  };
  await kv.put(KV_KEY, JSON.stringify(state));
}

// ── JSON response helper ─────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ── SSE Chat with DeepSeek ───────────────────────────────────

async function handleChat(request: Request, env: Env, state: { bookLog: BookLog; quotes: QuoteCollector }): Promise<Response> {
  const { message } = (await request.json()) as { message: string };
  if (!message) return json({ error: "message is required" }, 400);

  const completedBooks = state.bookLog.completed();
  const recentBooks = completedBooks.slice(0, 10).map(
    (b) => `- "${b.title}" by ${b.author} (${b.rating}/5)`
  );

  const randomQuote = state.quotes.random();
  const quoteContext = randomQuote
    ? `\nNotable quote from their collection: "${randomQuote.text}"`
    : "";

  const systemPrompt = `You are a literary companion for booklog.ai — warm, insightful, and passionate about reading.
You help readers discover books, discuss literature, and deepen their reading practice.

The reader has completed ${completedBooks.length} book(s).
Recent reads:
${recentBooks.length > 0 ? recentBooks.join("\n") : "No books yet."}${quoteContext}

Be conversational but substantive. Recommend with conviction. Reference their history when relevant.`;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: data })}\n\n`));

      try {
        const resp = await fetch(env.DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
            stream: true,
          }),
        });

        if (!resp.ok || !resp.body) {
          const errText = await resp.text().catch(() => "Unknown error");
          send(`I'm having trouble connecting right now. Please try again later. (${resp.status})`);
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (!trimmed.startsWith("data: ")) continue;

            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) send(content);
            } catch {
              // skip malformed chunks
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        send("Something went wrong. Please try again.");
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ── Route handler ────────────────────────────────────────────

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  const path = url.pathname;

  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', repo: 'booklog-ai', timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
    if (path === '/vessel.json') { try { const vj = await import('./vessel.json', { with: { type: 'json' } }); return json(vj.default || vj); } catch { return json({}); } }



  const method = request.method;

  // CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Serve inline landing page at root
  if (path === "/" || path === "/index.html") {
    return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookLog.ai — AI Reading Companion</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0;min-height:100vh}a{color:#a78bfa;text-decoration:none}.hero{max-width:800px;margin:0 auto;padding:80px 24px 40px;text-align:center}.logo{font-size:64px;margin-bottom:16px}h1{font-size:clamp(2rem,5vw,3rem);font-weight:700;background:linear-gradient(135deg,#a78bfa,#7c6aef);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:12px}.tagline{font-size:1.15rem;color:#94a3b8;max-width:500px;margin:0 auto 48px;line-height:1.6}.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;max-width:700px;margin:0 auto;padding:0 24px 60px}.feat{background:#111118;border:1px solid #1e1e2e;border-radius:12px;padding:20px;transition:border-color .2s}.feat:hover{border-color:#a78bfa44}.feat-icon{color:#a78bfa;font-size:1.2rem;margin-bottom:8px}.feat-text{font-size:.9rem;color:#cbd5e1}.chat-section{max-width:700px;margin:0 auto;padding:0 24px 80px}.chat-box{background:#111118;border:1px solid #1e1e2e;border-radius:16px;padding:24px}.chat-box h3{font-size:1.1rem;margin-bottom:12px;color:#a78bfa}.chat-box p{font-size:.9rem;color:#94a3b8;line-height:1.6;margin-bottom:16px}.chat-input{display:flex;gap:8px}.chat-input input{flex:1;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:8px;padding:10px 14px;color:#e2e8f0;font-size:.9rem;outline:none}.chat-input input:focus{border-color:#a78bfa}.chat-input button{background:linear-gradient(135deg,#a78bfa,#7c6aef);color:#0a0a0f;border:none;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:.9rem}.chat-input button:hover{opacity:.9}.fleet{text-align:center;padding:40px 24px;color:#475569;font-size:.8rem}.fleet a{color:#64748b;margin:0 8px}</style></head><body><div class="hero"><div class="logo">\U0001F4D6</div><h1>BookLog.ai</h1><p class="tagline">Track your reading journey, discover new books, and get AI-powered insights on any title.</p></div><div class="features"><div class="feat"><div class="feat-icon">\u2726</div><div class="feat-text">Reading tracker</div></div><div class="feat"><div class="feat-icon">\u2726</div><div class="feat-text">Book recommendations</div></div><div class="feat"><div class="feat-icon">\u2726</div><div class="feat-text">Reading goals</div></div><div class="feat"><div class="feat-icon">\u2726</div><div class="feat-text">Quote collection</div></div><div class="feat"><div class="feat-icon">\u2726</div><div class="feat-text">Stats & insights</div></div><div class="feat"><div class="feat-icon">\u2726</div><div class="feat-text">AI book chat</div></div></div><div class="chat-section"><div class="chat-box"><h3>\U0001F4D6 Chat with BookLog</h3><p>Powered by <a href="https://cocapn.ai">Cocapn</a> — bring your own API key or try with 5 free messages.</p><div class="chat-input"><input type="text" id="msg" placeholder="Ask about any book..."><button onclick="send()">Send</button></div></div></div><div class="fleet"><a href="https://the-fleet.casey-digennaro.workers.dev">\u2693 The Fleet</a> \u00b7 <a href="https://cocapn.ai">Cocapn</a> \u00b7 <a href="https://github.com/Lucineer/booklog-ai">GitHub</a></div><script>async function send(){const m=document.getElementById(\"msg\"),t=m.value.trim();if(!t)return;const r=await fetch(\"/api/chat\",{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:JSON.stringify({message:t})});const d=await r.json();alert(d.response||d.error||\"No response\");m.value=\"\"}document.getElementById(\"msg\").addEventListener(\"keydown\",e=>{if(e.key===\"Enter\")send()});</script></body></html>`, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }

  // ── POST /api/chat ────────────────────────────────────────
  if (path === "/api/chat" && method === "POST") {
    const state = await getState(env.BOOKLOG_KV);
    return handleChat(request, env, state);
  }

  // ── /api/books ────────────────────────────────────────────
  if (path === "/api/books") {
    const state = await getState(env.BOOKLOG_KV);

    if (method === "GET") {
      const reading = url.searchParams.get("reading");
      if (reading === "current") return json(state.bookLog.currentlyReading());
      if (reading === "completed") return json(state.bookLog.completed());
      return json(state.bookLog.all());
    }

    if (method === "POST") {
      const body = (await request.json()) as {
        title: string;
        author: string;
        rating?: number;
        review?: string;
        startDate: string;
        endDate?: string | null;
        pages?: number;
        genres?: string[];
      };
      const book = state.bookLog.add({
        title: body.title,
        author: body.author,
        rating: body.rating ?? 0,
        review: body.review ?? "",
        startDate: body.startDate ?? new Date().toISOString().slice(0, 10),
        endDate: body.endDate ?? null,
        pages: body.pages ?? 0,
        genres: body.genres ?? [],
      });
      await putState(env.BOOKLOG_KV, state.bookLog, state.goals, state.quotes);
      return json(book, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  }

  // /api/books/:id
  const bookMatch = path.match(/^\/api\/books\/([a-f0-9-]+)$/);
  if (bookMatch) {
    const id = bookMatch[1];
    const state = await getState(env.BOOKLOG_KV);

    if (method === "GET") {
      const book = state.bookLog.get(id);
      return book ? json(book) : json({ error: "Not found" }, 404);
    }

    if (method === "PUT") {
      const patch = (await request.json()) as Record<string, unknown>;
      const updated = state.bookLog.update(id, patch);
      if (!updated) return json({ error: "Not found" }, 404);
      await putState(env.BOOKLOG_KV, state.bookLog, state.goals, state.quotes);
      return json(updated);
    }

    if (method === "DELETE") {
      state.bookLog.remove(id);
      await putState(env.BOOKLOG_KV, state.bookLog, state.goals, state.quotes);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  }

  // ── /api/reading/goals ────────────────────────────────────
  if (path === "/api/reading/goals") {
    const state = await getState(env.BOOKLOG_KV);

    if (method === "GET") {
      const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
      const goals = state.goals.all();
      const progress = state.goals.progress(year);
      return json({ goals, progress });
    }

    if (method === "POST") {
      const body = (await request.json()) as { year: number; targetBooks: number; targetPages: number };
      const goal = state.goals.set(body.year, body.targetBooks, body.targetPages);
      await putState(env.BOOKLOG_KV, state.bookLog, state.goals, state.quotes);
      return json(goal, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  }

  // ── /api/reading/stats ────────────────────────────────────
  if (path === "/api/reading/stats" && method === "GET") {
    const state = await getState(env.BOOKLOG_KV);
    const stats = ReadingStatsCalculator.compute(state.bookLog);
    return json(stats);
  }

  // ── /api/recommendations ──────────────────────────────────
  if (path === "/api/recommendations" && method === "GET") {
    const state = await getState(env.BOOKLOG_KV);
    const engine = new RecommendationEngine(state.bookLog);
    const count = parseInt(url.searchParams.get("count") ?? "5");
    return json(engine.suggest(count));
  }

  // ── /api/quotes ───────────────────────────────────────────
  if (path === "/api/quotes") {
    const state = await getState(env.BOOKLOG_KV);

    if (method === "GET") {
      const bookId = url.searchParams.get("bookId");
      if (bookId) return json(state.quotes.forBook(bookId));
      const tag = url.searchParams.get("tag");
      if (tag) return json(state.quotes.byTag(tag));
      return json(state.quotes.all());
    }

    if (method === "POST") {
      const body = (await request.json()) as {
        bookId: string;
        text: string;
        page?: number;
        tags?: string[];
      };
      const quote = state.quotes.add({
        bookId: body.bookId,
        text: body.text,
        page: body.page ?? null,
        tags: body.tags ?? [],
      });
      await putState(env.BOOKLOG_KV, state.bookLog, state.goals, state.quotes);
      return json(quote, 201);
    }

    return json({ error: "Method not allowed" }, 405);
  }

  // DELETE /api/quotes/:id
  const quoteMatch = path.match(/^\/api\/quotes\/([a-f0-9-]+)$/);
  if (quoteMatch && method === "DELETE") {
    const state = await getState(env.BOOKLOG_KV);
    state.quotes.remove(quoteMatch[1]);
    await putState(env.BOOKLOG_KV, state.bookLog, state.goals, state.quotes);
    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

// ── Export ───────────────────────────────────────────────────

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
