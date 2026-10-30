import { z } from "zod";
import { auth } from "@/auth";
import { timelineData } from "@/lib/timeline";

// GET /api/timeline?view=day|week|month&date=YYYY-MM-DD — диаграмма Ганта (админ и менеджер).
const query = z.object({ view: z.enum(["day", "week", "month"]), date: z.iso.date() });

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role === "EMPLOYEE") return Response.json({ error: "forbidden" }, { status: 403 });
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
  return Response.json(await timelineData(parsed.data.view, parsed.data.date));
}
