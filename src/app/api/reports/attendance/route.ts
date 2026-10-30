import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { db } from "@/lib/db";
import { buildReportRows, writeReportXlsx } from "@/lib/reports/attendance";

// GET /api/reports/attendance?from=2026-10-01&to=2026-10-31&locale=ru → .xlsx
// Скачивают админ и менеджер (SPEC.md, роли).
const query = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  locale: z.enum(routing.locales).catch(routing.defaultLocale),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.role === "EMPLOYEE") return Response.json({ error: "forbidden" }, { status: 403 });

  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success || parsed.data.from > parsed.data.to) return Response.json({ error: "invalid" }, { status: 400 });
  const { from, to, locale } = parsed.data;
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days > 366) return Response.json({ error: "tooLong" }, { status: 400 });

  const [workDays, employees] = await Promise.all([
    db.workDay.findMany({
      where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
      include: { employee: true, events: true },
    }),
    db.employee.findMany({ where: { OR: [{ isActive: true }, { workDays: { some: {} } }] } }),
  ]);

  const t = await getTranslations({ locale, namespace: "reports" });
  const file = await writeReportXlsx(buildReportRows(workDays, employees), { from, to }, (k, v) => t(k, v));

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="office-report_${from}_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
