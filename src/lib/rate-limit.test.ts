import { describe, expect, it, vi } from "vitest";
import { getClientIp, RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("разрешает запросы до достижения лимита", () => {
    const limiter = new RateLimiter(1000, 3);
    expect(limiter.check("user-1")).toMatchObject({ allowed: true, remaining: 2 });
    expect(limiter.check("user-1")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check("user-1")).toMatchObject({ allowed: true, remaining: 0 });
    // Четвертый запрос отклоняется
    expect(limiter.check("user-1")).toMatchObject({ allowed: false, remaining: 0 });
    limiter.destroy();
  });

  it("изолирует счетчики разных ключей", () => {
    const limiter = new RateLimiter(1000, 2);
    limiter.check("user-a");
    limiter.check("user-a");
    expect(limiter.check("user-a").allowed).toBe(false);

    // user-b не исчерпал лимит
    expect(limiter.check("user-b").allowed).toBe(true);
    limiter.destroy();
  });

  it("сбрасывает счетчик при вызове reset", () => {
    const limiter = new RateLimiter(1000, 2);
    limiter.check("user-1");
    limiter.check("user-1");
    expect(limiter.check("user-1").allowed).toBe(false);

    limiter.reset("user-1");
    expect(limiter.check("user-1").allowed).toBe(true);
    limiter.destroy();
  });

  it("восстанавливает лимит по истечении окна времени", () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1000, 2);

    limiter.check("user-1");
    limiter.check("user-1");
    expect(limiter.check("user-1").allowed).toBe(false);

    // Перематываем время на 1100 мс вперед
    vi.advanceTimersByTime(1100);

    expect(limiter.check("user-1").allowed).toBe(true);
    limiter.destroy();
    vi.useRealTimers();
  });
});

describe("getClientIp", () => {
  it("извлекает IP из x-forwarded-for с поддержкой цепочки прокси", () => {
    const req = new Request("http://localhost:3000", {
      headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
    });
    expect(getClientIp(req)).toBe("203.0.113.195");
  });

  it("извлекает IP из x-real-ip если нет forwarded", () => {
    const req = new Request("http://localhost:3000", {
      headers: { "x-real-ip": "198.51.100.42" },
    });
    expect(getClientIp(req)).toBe("198.51.100.42");
  });

  it("возвращает 127.0.0.1 по умолчанию", () => {
    const req = new Request("http://localhost:3000");
    expect(getClientIp(req)).toBe("127.0.0.1");
  });
});
