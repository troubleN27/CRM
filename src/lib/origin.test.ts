import { describe, expect, it } from "vitest";
import { isSameOrigin } from "./origin";

describe("CSRF / isSameOrigin", () => {
  it("разрешает запрос с совпадающим Origin", () => {
    const req = new Request("http://localhost:3000/api/attendance", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("блокирует запрос с чужим Origin", () => {
    const req = new Request("http://localhost:3000/api/attendance", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "https://evil-attacker.com",
      },
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("блокирует запрос с Sec-Fetch-Site: cross-site даже при отсутствии Origin", () => {
    const req = new Request("http://localhost:3000/api/attendance", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        "sec-fetch-site": "cross-site",
      },
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("учитывает x-forwarded-host за reverse proxy", () => {
    const req = new Request("http://10.0.0.1/api/attendance", {
      method: "POST",
      headers: {
        host: "10.0.0.1",
        "x-forwarded-host": "crm.company.com",
        origin: "https://crm.company.com",
      },
    });
    expect(isSameOrigin(req)).toBe(true);
  });

  it("блокирует поддельный referer", () => {
    const req = new Request("http://localhost:3000/api/attendance", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        referer: "https://phishing.site/fake-page",
      },
    });
    expect(isSameOrigin(req)).toBe(false);
  });

  it("разрешает запросы без браузерных заголовков (скрипты/тесты)", () => {
    const req = new Request("http://localhost:3000/api/attendance", {
      method: "POST",
    });
    expect(isSameOrigin(req)).toBe(true);
  });
});
