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

  if (path === '/health') {
    return new Response(JSON.stringify({ status: 'ok', repo: 'booklog-ai', timestamp: Date.now() }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  const path = url.pathname;
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
    return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>booklog.ai</title><style>body{font-family:monospace;background:#0a0a1a;color:#c4c4e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}</style></head><body><div style="text-align:center"><h1 style="font-size:48px;font-weight:200;letter-spacing:8px;color:#7c6aef">booklog</h1><p style="color:#6a6a8e;letter-spacing:3px">BOOKS · READING · INSIGHTS</p><p style="margin-top:48px"><a href="/app.html" style="padding:14px 40px;background:#7c6aef;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Open booklog</a></p></div></body></html>`, { headers: { "Content-Type": "text/html" } });
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
