import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isDeviceKey, livePeople } from "@/lib/positions";

// GET /api/positions/live — кто где прямо сейчас.
// Вошедшие пользователи видят план офиса; точки в городе — только админ (CLAUDE.md, «Доступ»).
// Устройства с ключом получают всё плюс зоны плана и заявки — для имитации.
export async function GET(req: Request) {
  const device = isDeviceKey(req.headers.get("authorization"));
  const session = device ? null : await auth();
  if (!device && !session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const people = await livePeople();
  const seeCity = device || session?.user.role === "ADMIN";
  const visible = people.map((p) =>
    seeCity ? p : { ...p, outReason: null, outSince: null, request: null, last: p.last?.kind === "OFFICE" ? p.last : null },
  );

  if (!device) return Response.json({ people: visible });

  const zones = await db.zone.findMany({ select: { id: true, type: true, x: true, y: true, width: true, height: true } });
  const center = (process.env.CITY_CENTER ?? "41.3111,69.2797").split(",").map(Number);
  return Response.json({ people: visible, zones, cityCenter: { lat: center[0], lng: center[1] } });
}
