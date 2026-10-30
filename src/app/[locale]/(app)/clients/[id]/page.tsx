import { notFound } from"next/navigation";
import { getTranslations, setRequestLocale } from"next-intl/server";
import { Link } from"@/i18n/navigation";
import { PointsMap } from"@/components/map";
import { buttonClass } from"@/components/ui";
import { RequestsTable } from"@/components/RequestsTable";
import { db } from"@/lib/db";
import { canManageRequests } from"@/lib/requests";
import { requireUser } from"@/lib/session";

export default async function ClientPage({ params }: PageProps<"/[locale]/clients/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();

  const client = await db.client.findUnique({
    where: { id },
    include: { requests: { include: { client: true, assignee: true }, orderBy: { number: "desc" } } },
  });
  if (!client) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-medium text-fg">{client.name}</h1>
        {canManageRequests(user.role) && (
          <Link href={`/requests/new?client=${client.id}`} className={`${buttonClass} ml-auto`}>
            {t("requests.add")}
          </Link>
        )}
      </div>
      <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-line bg-surface p-4 text-sm">
        <dt className="text-fg-2">{t("clients.phone")}</dt>
        <dd>{client.phone}</dd>
        <dt className="text-fg-2">{t("clients.address")}</dt>
        <dd>{client.address}</dd>
      </dl>
      <PointsMap points={[{ id: client.id, lat: client.lat, lng: client.lng, label: client.name }]} height={280} zoom={14} />
      <h2 className="pt-2 text-lg font-medium">{t("requests.title")}</h2>
      <RequestsTable requests={client.requests} />
    </div>
  );
}
