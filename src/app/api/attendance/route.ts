import { auth } from "@/auth";
import { checkIn, comeBack, endWork, goOut, todayWorkDay } from "@/lib/attendance/service";
import { db } from "@/lib/db";
import { isSameOrigin } from "@/lib/origin";

// Отметки текущего пользователя.
// GET — состояние на сегодня.
// POST {action: "in" | "out" | "back" | "end", reason?: "LUNCH" | "CLIENT_VISIT" | "PERSONAL", requestId?}.

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const day = await todayWorkDay(session.user.employeeId);
  const me = await db.employee.findUnique({ where: { id: session.user.employeeId }, select: { status: true } });
  return Response.json({
    checkedIn: Boolean(day),
    ended: Boolean(day?.endedAt),
    out: me?.status === "OUT_OF_OFFICE" && Boolean(day && !day.endedAt),
    firstInAt: day?.firstInAt ?? null,
    endedAt: day?.endedAt ?? null,
    isLate: day?.isLate ?? false,
    lateMinutes: day?.lateMinutes ?? 0,
  });
}

const REASONS = ["LUNCH", "CLIENT_VISIT", "PERSONAL"] as const;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });

  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = session.user.employeeId;

  let result;
  switch (body?.action) {
    case "in":
      result = await checkIn(id);
      break;
    case "end":
      result = await endWork(id);
      break;
    case "back":
      result = await comeBack(id);
      break;
    case "out":
      if (!REASONS.includes(body.reason)) return Response.json({ error: "invalid" }, { status: 400 });
      result = await goOut(id, body.reason, typeof body.requestId === "string" ? body.requestId : null);
      break;
    default:
      return Response.json({ error: "invalid" }, { status: 400 });
  }
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
