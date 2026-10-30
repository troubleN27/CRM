/**
 * In-memory Rate Limiter для защиты от подбора паролей (Brute-Force) и DDoS/флуда эндпоинтов.
 * Использует алгоритм скользящего окна / фиксированного окна с автоочисткой устаревших ключей.
 */

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number;
};

type Entry = {
  count: number;
  resetAt: number;
};

export class RateLimiter {
  private map = new Map<string, Entry>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly windowMs: number,
    public readonly max: number
  ) {
    if (typeof setInterval !== "undefined") {
      const timer = setInterval(() => this.cleanup(), Math.max(windowMs, 10000));
      if (timer.unref) timer.unref();
      this.sweepTimer = timer;
    }
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.map.get(key);

    if (!entry || now > entry.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.max - 1, resetMs: this.windowMs };
    }

    if (entry.count >= this.max) {
      return { allowed: false, remaining: 0, resetMs: Math.max(0, entry.resetAt - now) };
    }

    entry.count += 1;
    return { allowed: true, remaining: this.max - entry.count, resetMs: Math.max(0, entry.resetAt - now) };
  }

  reset(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.map.entries()) {
      if (now > entry.resetAt) {
        this.map.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    this.map.clear();
  }
}

/**
 * Извлекает IP-адрес клиента из заголовков запроса (с поддержкой reverse proxy).
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}

// Предопределённые лимитеры:
// 1. Попытки авторизации: до 10 попыток в минуту на логин/IP
export const loginRateLimiter = new RateLimiter(60_000, 10);

// 2. Отправка геопозиций: до 120 запросов в минуту (телефон шлёт раз в 3 сек = 20/мин)
export const positionsRateLimiter = new RateLimiter(60_000, 120);

// 3. Поиск: до 60 запросов в минуту
export const searchRateLimiter = new RateLimiter(60_000, 60);
