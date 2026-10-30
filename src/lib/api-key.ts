import { timingSafeEqual } from "node:crypto";

// Сравнить заголовок «Authorization: Bearer <ключ>» с секретом из .env без утечки по времени.
// Пустой секрет никого не пускает.
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  const given = header?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !given) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
