import { auth } from "@/auth";
import { requestEntity } from "@/lib/entities";
import { mustCheckIn } from "@/lib/session";

// GET /api/entities/request/[id] — данные выезжающей карточки заявки.
export async function GET(_req: Request, ctx: RouteContext<"/api/entities/request/[id]">) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (await mustCheckIn(session.user)) return Response.json({ error: "checkInFirst" }, { status: 403 });
  const { id } = await ctx.params;
  const entity = await requestEntity(id, session.user);
  return entity ? Response.json(entity) : Response.json({ error: "notFound" }, { status: 404 });
}
