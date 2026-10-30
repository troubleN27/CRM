/**
 * CSRF-защита / Проверка Origin (рекомендации OWASP).
 * Сверяет заголовки Origin и Referer с фактическим хостом приложения.
 * Браузеры при межсайтовых запросах (CSRF) всегда передают заголовок Origin
 * с адресом стороннего сайта и выставляют Sec-Fetch-Site: cross-site.
 */
export function isSameOrigin(req: Request): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "cross-site") {
    return false;
  }

  const hostHeader = (req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host)
    .split(",")[0]
    .trim()
    .toLowerCase();

  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      return originHost === hostHeader;
    } catch {
      return false;
    }
  }

  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refererHost = new URL(referer).host.toLowerCase();
      return refererHost === hostHeader;
    } catch {
      return false;
    }
  }

  if (secFetchSite) {
    return secFetchSite === "same-origin" || secFetchSite === "none";
  }

  // Для служебных вызовов без браузерных заголовков (тесты, скрипты)
  return true;
}
