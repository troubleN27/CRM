import { auth } from "@/auth";
import { isSameOrigin } from "@/lib/origin";
import { isDeviceKey, positionsBatchSchema, recordPositions } from "@/lib/positions";
import { getClientIp, positionsRateLimiter } from "@/lib/rate-limit";

// POST /api/positions — единое место для всех позиций.
// Устройства (имитация, датчики): заголовок Authorization: Bearer <POSITIONS_API_KEY>, любые сотрудники.
// Телефон сотрудника: обычный вход на сайт, только свои точки на карте.
// Тело: { source, positions: [{ employeeId, kind: "OFFICE", x, y } | { employeeId, kind: "CITY", lat, lng, accuracy? }] }
export async function POST(req: Request) {
  const device = isDeviceKey(req.headers.get("authorization"));
  const session = device ? null : await auth();
  if (!device && !session) return Response.json({ error: "unauthorized" }, { status: 401 });

  // CSRF-проверка для сессионных запросов из браузера
  if (session && !isSameOrigin(req)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // Rate Limiting для предотвращения флуда координатами
  const limitKey = session ? `emp:${session.user.employeeId}` : `dev:${getClientIp(req)}`;
  if (!positionsRateLimiter.check(limitKey).allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = positionsBatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  const { source, positions } = parsed.data;

  if (session) {
    const own = positions.every((p) => p.employeeId === session.user.employeeId && p.kind === "CITY");
    if (!own) return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await recordPositions(session ? "phone" : source, positions);
  return Response.json(result);
}
