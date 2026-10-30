import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { cityMap } from "@/lib/dashboard";

// GET /api/admin/city?locale=ru — офис, открытые заявки и сотрудники вне офиса для карты города (только админ).
export async function GET(req: Request) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: session ? 403 : 401 });
  const locale = new URL(req.url).searchParams.get("locale");
  return Response.json(await cityMap(routing.locales.find((l) => l === locale) ?? routing.defaultLocale));
}
