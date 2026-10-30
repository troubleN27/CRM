import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getClientIp, searchRateLimiter } from "@/lib/rate-limit";
import { mustCheckIn } from "@/lib/session";

// GET /api/search?q=… — поиск для меню команд (Ctrl+K): сотрудники, клиенты, заявки.
// Пока сотрудник не отметил приход, поиск закрыт, как и разделы сайта.
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (await mustCheckIn(session.user)) return Response.json({ error: "checkInFirst" }, { status: 403 });

  if (!searchRateLimiter.check(`search:${getClientIp(req)}`).allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  // Ограничиваем длину запроса для защиты от ReDoS и перегрузки базы данных
  if (q.length < 2 || q.length > 100) return Response.json({ employees: [], clients: [], requests: [] });
  const like = { contains: q, mode: "insensitive" as const };
  const number = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;

  const [employees, clients, requests] = await Promise.all([
    db.employee.findMany({
      where: { isActive: true, OR: [{ firstName: like }, { lastName: like }, { position: like }] },
      select: { id: true, firstName: true, lastName: true, position: true, status: true },
      take: 6,
    }),
    db.client.findMany({ where: { OR: [{ name: like }, { address: like }] }, select: { id: true, name: true, address: true }, take: 6 }),
    db.request.findMany({
      where: { OR: [{ description: like }, { client: { name: like } }, ...(number ? [{ number }] : [])] },
      select: { id: true, number: true, description: true, status: true, client: { select: { name: true } } },
      orderBy: { number: "desc" },
      take: 6,
    }),
  ]);

  return Response.json({
    employees: employees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, position: e.position, status: e.status })),
    clients,
    requests: requests.map((r) => ({ id: r.id, number: r.number, description: r.description, status: r.status, client: r.client.name })),
  });
}
