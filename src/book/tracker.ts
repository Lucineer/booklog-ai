// ── Domain Types ──────────────────────────────────────────────

export interface Book {
  id: string;
  title: string;
  author: string;
  rating: number;       // 1-5
  review: string;
  startDate: string;    // ISO date
  endDate: string | null;
  pages: number;
  genres: string[];
}

export interface ReadingGoal {
  id: string;
  year: number;
  targetBooks: number;
  targetPages: number;
  completed: boolean;
}

export interface ReadingStats {
  totalPagesRead: number;
  totalBooksCompleted: number;
  avgPagesPerDay: number;
  avgBooksPerYear: number;
  avgRating: number;
  booksByGenre: Record<string, number>;
  pagesByMonth: Record<string, number>;
  currentStreak: number;
  longestStreak: number;
}

export interface Quote {
  id: string;
  bookId: string;
  text: string;
  page: number | null;
  tags: string[];
  createdAt: string;
}

export interface Recommendation {
  title: string;
  author: string;
  reason: string;
  confidence: number;
}

// ── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

// ── BookLog ──────────────────────────────────────────────────

export class BookLog {
  private books: Map<string, Book> = new Map();

  add(input: Omit<Book, "id">): Book {
    const book: Book = { ...input, id: generateId() };
    this.books.set(book.id, book);
    return book;
  }

  update(id: string, patch: Partial<Omit<Book, "id">>): Book | null {
    const existing = this.books.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    this.books.set(id, updated);
    return updated;
  }

  remove(id: string): boolean {
    return this.books.delete(id);
  }

  get(id: string): Book | null {
    return this.books.get(id) ?? null;
  }

  all(): Book[] {
    return [...this.books.values()].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }

  completed(): Book[] {
    return this.all().filter((b) => b.endDate !== null);
  }

  currentlyReading(): Book[] {
    return this.all().filter((b) => b.endDate === null);
  }

  byAuthor(author: string): Book[] {
    const q = author.toLowerCase();
    return this.all().filter((b) => b.author.toLowerCase().includes(q));
  }

  byGenre(genre: string): Book[] {
    return this.all().filter((b) => b.genres.some((g) => g.toLowerCase() === genre.toLowerCase()));
  }

  toJSON(): object {
    return { books: Object.fromEntries(this.books) };
  }

  static fromJSON(data: { books: Record<string, Book> }): BookLog {
    const log = new BookLog();
    for (const book of Object.values(data.books)) {
      log.books.set(book.id, book);
    }
    return log;
  }
}

// ── ReadingGoals ─────────────────────────────────────────────

export class ReadingGoals {
  private goals: Map<string, ReadingGoal> = new Map();
  private books: BookLog;

  constructor(books: BookLog) {
    this.books = books;
  }

  set(year: number, targetBooks: number, targetPages: number): ReadingGoal {
    const existing = this.forYear(year);
    if (existing) {
      existing.targetBooks = targetBooks;
      existing.targetPages = targetPages;
      return existing;
    }
    const goal: ReadingGoal = {
      id: generateId(),
      year,
      targetBooks,
      targetPages,
      completed: false,
    };
    this.goals.set(goal.id, goal);
    return goal;
  }

  forYear(year: number): ReadingGoal | undefined {
    for (const g of this.goals.values()) {
      if (g.year === year) return g;
    }
    return undefined;
  }

  progress(year: number): { books: { current: number; target: number }; pages: { current: number; target: number } } {
    const completed = this.books.completed().filter((b) => {
      const end = b.endDate!;
      return new Date(end).getFullYear() === year;
    });
    const goal = this.forYear(year);
    const totalPages = completed.reduce((s, b) => s + b.pages, 0);
    return {
      books: { current: completed.length, target: goal?.targetBooks ?? 0 },
      pages: { current: totalPages, target: goal?.targetPages ?? 0 },
    };
  }

  all(): ReadingGoal[] {
    return [...this.goals.values()].sort((a, b) => b.year - a.year);
  }

  toJSON(): object {
    return { goals: Object.fromEntries(this.goals) };
  }

  static fromJSON(data: { goals: Record<string, ReadingGoal> }, books: BookLog): ReadingGoals {
    const rg = new ReadingGoals(books);
    for (const goal of Object.values(data.goals)) {
      rg.goals.set(goal.id, goal);
    }
    return rg;
  }
}

// ── ReadingStats ─────────────────────────────────────────────

export class ReadingStatsCalculator {
  static compute(books: BookLog): ReadingStats {
    const completed = books.completed();
    if (completed.length === 0) {
      return {
        totalPagesRead: 0,
        totalBooksCompleted: 0,
        avgPagesPerDay: 0,
        avgBooksPerYear: 0,
        avgRating: 0,
        booksByGenre: {},
        pagesByMonth: {},
        currentStreak: 0,
        longestStreak: 0,
      };
    }

    const totalPagesRead = completed.reduce((s, b) => s + b.pages, 0);
    const totalDays = completed.reduce(
      (s, b) => s + daysBetween(b.startDate, b.endDate!),
      0
    );
    const avgPagesPerDay = Math.round(totalPagesRead / totalDays);

    // books/year: count books per unique year, average across years
    const yearSet = new Set(completed.map((b) => new Date(b.endDate!).getFullYear()));
    const avgBooksPerYear = Math.round(completed.length / Math.max(1, yearSet.size));

    const avgRating =
      Math.round((completed.reduce((s, b) => s + b.rating, 0) / completed.length) * 10) / 10;

    const booksByGenre: Record<string, number> = {};
    for (const b of completed) {
      for (const g of b.genres) {
        booksByGenre[g] = (booksByGenre[g] ?? 0) + 1;
      }
    }

    const pagesByMonth: Record<string, number> = {};
    for (const b of completed) {
      const month = b.endDate!.slice(0, 7); // "YYYY-MM"
      pagesByMonth[month] = (pagesByMonth[month] ?? 0) + b.pages;
    }

    // Reading streak calculation
    const endDates = completed
      .map((b) => b.endDate!)
      .sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let streak = 1;

    for (let i = 1; i < endDates.length; i++) {
      const diff = daysBetween(endDates[i - 1], endDates[i]);
      if (diff <= 3) {
        streak++;
      } else {
        longestStreak = Math.max(longestStreak, streak);
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);

    // current streak: count backwards from today
    const today = new Date().toISOString().slice(0, 10);
    const todayTime = new Date(today).getTime();
    const recent = endDates.filter((d) => daysBetween(d, today) <= 3);
    currentStreak = recent.length > 0 ? Math.min(streak, recent.length) : 0;

    return {
      totalPagesRead,
      totalBooksCompleted: completed.length,
      avgPagesPerDay,
      avgBooksPerYear,
      avgRating,
      booksByGenre,
      pagesByMonth,
      currentStreak,
      longestStreak,
    };
  }
}

// ── RecommendationEngine ─────────────────────────────────────

export class RecommendationEngine {
  private books: BookLog;

  constructor(books: BookLog) {
    this.books = books;
  }

  suggest(count: number = 5): Recommendation[] {
    const completed = this.books.completed();
    if (completed.length === 0) {
      return [
        { title: "The Great Gatsby", author: "F. Scott Fitzgerald", reason: "A timeless classic to start your reading journey", confidence: 0.5 },
        { title: "Sapiens", author: "Yuval Noah Harari", reason: "A thought-provoking exploration of human history", confidence: 0.5 },
        { title: "Dune", author: "Frank Herbert", reason: "A masterpiece of science fiction world-building", confidence: 0.5 },
        { title: "Project Hail Mary", author: "Andy Weir", reason: "An engaging page-turner perfect for new readers", confidence: 0.5 },
        { title: "The Name of the Wind", author: "Patrick Rothfuss", reason: "Beautifully written fantasy with rich prose", confidence: 0.5 },
      ];
    }

    // Build preference profile
    const genreScores: Record<string, number> = {};
    const authorScores: Record<string, number> = {};
    let avgRating = 0;

    for (const b of completed) {
      avgRating += b.rating;
      for (const g of b.genres) {
        genreScores[g] = (genreScores[g] ?? 0) + b.rating;
      }
      authorScores[b.author] = (authorScores[b.author] ?? 0) + b.rating;
    }
    avgRating /= completed.length;

    const topGenres = Object.entries(genreScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([g]) => g);

    const topAuthors = Object.entries(authorScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([a]) => a);

    // Curated recommendation pool organized by genre
    const pool: Record<string, { title: string; author: string; genres: string[] }[]> = {
      Fiction: [
        { title: "The Remains of the Day", author: "Kazuo Ishiguro", genres: ["Literary Fiction"] },
        { title: "A Gentleman in Moscow", author: "Amor Towles", genres: ["Historical Fiction"] },
        { title: "The Goldfinch", author: "Donna Tartt", genres: ["Literary Fiction"] },
      ],
      "Science Fiction": [
        { title: "Neuromancer", author: "William Gibson", genres: ["Science Fiction", "Cyberpunk"] },
        { title: "The Left Hand of Darkness", author: "Ursula K. Le Guin", genres: ["Science Fiction"] },
        { title: "Children of Time", author: "Adrian Tchaikovsky", genres: ["Science Fiction"] },
      ],
      Fantasy: [
        { title: "The Fifth Season", author: "N.K. Jemisin", genres: ["Fantasy"] },
        { title: "Piranesi", author: "Susanna Clarke", genres: ["Fantasy", "Literary Fiction"] },
        { title: "The Lies of Locke Lamora", author: "Scott Lynch", genres: ["Fantasy"] },
      ],
      "Non-Fiction": [
        { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", genres: ["Non-Fiction", "Psychology"] },
        { title: "The Art of Learning", author: "Josh Waitzkin", genres: ["Non-Fiction"] },
        { title: "Range", author: "David Epstein", genres: ["Non-Fiction"] },
      ],
      Mystery: [
        { title: "The Seven Deaths of Evelyn Hardcastle", author: "Stuart Turton", genres: ["Mystery", "Thriller"] },
        { title: "In the Woods", author: "Tana French", genres: ["Mystery"] },
      ],
      History: [
        { title: "The Silk Roads", author: "Peter Frankopan", genres: ["History", "Non-Fiction"] },
        { title: "SPQR", author: "Mary Beard", genres: ["History"] },
      ],
    };

    const readTitles = new Set(completed.map((b) => b.title.toLowerCase()));

    const scored: Recommendation[] = [];
    for (const [, entries] of Object.entries(pool)) {
      for (const entry of entries) {
        if (readTitles.has(entry.title.toLowerCase())) continue;

        let confidence = 0.3;
        const genreOverlap = entry.genres.filter((g) => topGenres.includes(g)).length;
        confidence += genreOverlap * 0.2;

        if (topAuthors.some((a) => a === entry.author)) {
          confidence += 0.15;
        }

        scored.push({
          title: entry.title,
          author: entry.author,
          reason: this.buildReason(entry, topGenres, genreOverlap > 0),
          confidence: Math.min(0.95, confidence),
        });
      }
    }

    return scored
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, count);
  }

  private buildReason(
    entry: { title: string; author: string; genres: string[] },
    topGenres: string[],
    genreMatch: boolean
  ): string {
    if (genreMatch) {
      return `Matches your interest in ${entry.genres.filter((g) => topGenres.includes(g)).join(" and ")}`;
    }
    return `A ${entry.genres[0]} pick to broaden your reading horizons`;
  }
}

// ── QuoteCollector ───────────────────────────────────────────

export class QuoteCollector {
  private quotes: Map<string, Quote> = new Map();

  add(input: Omit<Quote, "id" | "createdAt">): Quote {
    const quote: Quote = {
      ...input,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    this.quotes.set(quote.id, quote);
    return quote;
  }

  remove(id: string): boolean {
    return this.quotes.delete(id);
  }

  forBook(bookId: string): Quote[] {
    return [...this.quotes.values()]
      .filter((q) => q.bookId === bookId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  byTag(tag: string): Quote[] {
    return [...this.quotes.values()].filter((q) =>
      q.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    );
  }

  all(): Quote[] {
    return [...this.quotes.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  random(): Quote | null {
    const arr = [...this.quotes.values()];
    return arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
  }

  toJSON(): object {
    return { quotes: Object.fromEntries(this.quotes) };
  }

  static fromJSON(data: { quotes: Record<string, Quote> }): QuoteCollector {
    const qc = new QuoteCollector();
    for (const q of Object.values(data.quotes)) {
      qc.quotes.set(q.id, q);
    }
    return qc;
  }
}

// ── App State ────────────────────────────────────────────────

export interface AppState {
  bookLog: ReturnType<BookLog["toJSON"]>;
  goals: ReturnType<ReadingGoals["toJSON"]>;
  quotes: ReturnType<QuoteCollector["toJSON"]>;
}

export function loadState(data: AppState): {
  bookLog: BookLog;
  goals: ReadingGoals;
  quotes: QuoteCollector;
} {
  const bookLog = BookLog.fromJSON(data.bookLog as { books: Record<string, Book> });
  const goals = ReadingGoals.fromJSON(data.goals as { goals: Record<string, ReadingGoal> }, bookLog);
  const quotes = QuoteCollector.fromJSON(data.quotes as { quotes: Record<string, Quote> });
  return { bookLog, goals, quotes };
}
