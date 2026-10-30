import { auth } from "@/auth";
import { db } from "@/lib/db";
import { imageSize, MAX_PLAN_BYTES, sniffImageType } from "@/lib/office-plan";
import { isSameOrigin } from "@/lib/origin";

// Картинка плана офиса: смотреть могут все вошедшие, загружать — только админ.

export async function GET() {
  if (!(await auth())) return new Response(null, { status: 401 });
  const plan = await db.officePlan.findFirst({ orderBy: { createdAt: "desc" } });
  if (!plan) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(plan.data), {
    headers: {
      "Content-Type": plan.mimeType,
      // Адрес меняется с каждой новой картинкой (?v=...), поэтому кэшировать можно долго.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // Даже если открыть картинку напрямую, скрипты в ней не выполнятся.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });

  const session = await auth();
  if (session?.user.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "imageType" }, { status: 400 });
  if (file.size > MAX_PLAN_BYTES) return Response.json({ error: "imageTooBig" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return Response.json({ error: "imageType" }, { status: 400 });
  const size = imageSize(bytes, type);
  if (!size || size.width < 1 || size.height < 1) return Response.json({ error: "imageType" }, { status: 400 });

  // Храним один план: новая картинка заменяет старую. Места и зоны остаются —
  // их координаты в долях, поэтому они лягут на новую картинку в те же пропорции.
  await db.$transaction(async (tx) => {
    await tx.officePlan.deleteMany();
    const plan = await tx.officePlan.create({ data: { mimeType: type, data: Buffer.from(bytes), ...size } });
    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        entity: "OfficePlan",
        entityId: plan.id,
        action: "CREATE",
        after: { mimeType: type, ...size, bytes: bytes.length },
      },
    });
  });

  return Response.json({ ok: true });
}
