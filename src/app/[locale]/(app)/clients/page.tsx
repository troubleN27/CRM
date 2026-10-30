import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PointsMap } from "@/components/map";
import { buttonClass, pageTitleClass } from "@/components/ui";
import { db } from "@/lib/db";
import { canManageRequests } from "@/lib/requests";
import { requireUser } from "@/lib/session";
import { ClientsView, type ClientRow } from "./ClientsView";

export default async function ClientsPage({ params }: PageProps<"/[locale]/clients">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();

  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: { requests: { orderBy: { number: "desc" }, select: { number: true, description: true, status: true } } },
  });
  const rows: ClientRow[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    address: c.address,
    openRequests: c.requests.filter((r) => r.status !== "DONE").length,
    requests: c.requests,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className={pageTitleClass}>{t("clients.title")}</h1>
        {canManageRequests(user.role) && (
          <Link href="/clients/new" className={`${buttonClass} ml-auto`}>
            {t("clients.add")}
          </Link>
        )}
      </div>
      <div data-lenis-prevent className="overflow-hidden rounded-lg border border-line">
        <PointsMap points={clients.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, label: c.name, href: `/${locale}/clients/${c.id}` }))} height={300} />
      </div>
      <ClientsView rows={rows} />
    </div>
  );
}
