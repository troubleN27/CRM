import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { adminDashboard } from "@/lib/dashboard";

// GET /api/admin/dashboard?locale=ru — цифры, мини-карта офиса и лента событий для главной админа.
export async function GET(req: Request) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: session ? 403 : 401 });
  const locale = new URL(req.url).searchParams.get("locale");
  return Response.json(await adminDashboard(routing.locales.find((l) => l === locale) ?? routing.defaultLocale));
}
