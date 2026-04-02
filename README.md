# booklog.ai

A reading companion — track your books, set goals, collect quotes, and get personalized recommendations.

## Stack

- **Runtime:** Cloudflare Workers
- **Storage:** KV namespace
- **AI:** DeepSeek (SSE streaming chat)
- **UI:** Single-page HTML (literary aesthetic)

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | SSE chat with DeepSeek literary companion |
| GET/POST | `/api/books` | List or add books |
| GET/PUT/DELETE | `/api/books/:id` | Get, update, or remove a book |
| GET/POST | `/api/reading/goals` | View or set yearly reading goals |
| GET | `/api/reading/stats` | Pages/day, books/year, streaks, genre breakdown |
| GET | `/api/recommendations` | Personalized book suggestions |
| GET/POST | `/api/quotes` | List or add quotes |
| DELETE | `/api/quotes/:id` | Remove a quote |

## Domain Classes (`src/book/tracker.ts`)

- **BookLog** — CRUD for books with filtering (current, completed, by author/genre)
- **ReadingGoals** — Yearly book and page targets with progress tracking
- **ReadingStatsCalculator** — pages/day, books/year, average rating, streaks, genre distribution
- **RecommendationEngine** — Genre and author preference matching from reading history
- **QuoteCollector** — Save and tag memorable passages with book linkage

## Setup

```bash
npm install
npx wrangler login
npx wrangler kv:namespace create BOOKLOG_KV
# Update wrangler.toml with the KV binding ID
npx wrangler secret put DEEPSEEK_API_KEY
npm run dev
```

## Deploy

```bash
npm run deploy
```

## License

MIT — Built with ❤️ by [Superinstance](https://github.com/superinstance) & [Lucineer](https://github.com/Lucineer) (DiGennaro et al.)
