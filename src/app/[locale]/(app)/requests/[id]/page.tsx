import { notFound } from"next/navigation";
import { getTranslations, setRequestLocale } from"next-intl/server";
import { Link } from"@/i18n/navigation";
import { PointsMap } from"@/components/map";
import { buttonClass, inputClass, requestStatusColor } from"@/components/ui";
import { db } from"@/lib/db";
import { employeeOptions } from"@/lib/employees";
import { canManageRequests, canSetStatus, isOverdue, REQUEST_STATUSES } from"@/lib/requests";
import { requireUser } from"@/lib/session";
import { dateOnly, todayInOffice } from"@/lib/time";
import { assignRequest, setRequestStatus } from"../actions";

export default async function RequestPage({ params }: PageProps<"/[locale]/requests/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();

  const request = await db.request.findUnique({ where: { id }, include: { client: true, assignee: true } });
  if (!request) notFound();

  const canManage = canManageRequests(user.role);
  const employees = canManage ? await employeeOptions() : [];
  const statusOptions = REQUEST_STATUSES.filter(
    (s) => s === request.status || canSetStatus(user, request.assigneeId, s),
  );
  const due = request.dueDate ? dateOnly(request.dueDate) : null;
  const overdue = isOverdue(request.status, due, todayInOffice());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/requests" className="text-sm text-brand-fg hover:underline">
          ← {t("requests.title")}
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-medium text-fg">
          {t("requests.one")} #{request.number}
        </h1>
        <span className={`rounded px-2 py-0.5 text-sm ${requestStatusColor[request.status]}`}>
          {t(`requestStatus.${request.status}`)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-line bg-surface p-4 text-sm">
            <dt className="text-fg-2">{t("requests.client")}</dt>
            <dd>
              <Link href={`/clients/${request.client.id}`} className="text-brand-fg hover:underline">
                {request.client.name}
              </Link>
            </dd>
            <dt className="text-fg-2">{t("clients.phone")}</dt>
            <dd>{request.client.phone}</dd>
            <dt className="text-fg-2">{t("clients.address")}</dt>
            <dd>{request.client.address}</dd>
            <dt className="text-fg-2">{t("requests.description")}</dt>
            <dd className="whitespace-pre-line">{request.description}</dd>
            <dt className="text-fg-2">{t("requests.dueDate")}</dt>
            <dd className={overdue ? "font-medium text-danger" : ""}>
              {due ?? "—"}
              {overdue &&` · ${t("requests.overdue")}`}
            </dd>
            <dt className="text-fg-2">{t("requests.assignee")}</dt>
            <dd>{request.assignee ? `${request.assignee.firstName} ${request.assignee.lastName}` : t("requests.notAssigned")}</dd>
          </dl>

          {canManage && (
            <form action={assignRequest.bind(null, locale, request.id)} className="space-y-2 rounded-lg border border-line bg-surface p-4">
              <label className="block">
                <span className="text-sm font-medium">{t("requests.assignTitle")}</span>
                <select name="assigneeId" defaultValue={request.assigneeId ?? ""} className={inputClass}>
                  <option value="">{t("requests.notAssigned")}</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonClass}>
                {t("requests.assign")}
              </button>
            </form>
          )}

          {statusOptions.length > 1 && (
            <form action={setRequestStatus.bind(null, locale, request.id)} className="space-y-2 rounded-lg border border-line bg-surface p-4">
              <label className="block">
                <span className="text-sm font-medium">{t("requests.changeStatus")}</span>
                <select name="status" defaultValue={request.status} className={inputClass}>
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {t(`requestStatus.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonClass}>
                {t("common.save")}
              </button>
            </form>
          )}
        </div>

        <PointsMap
          points={[{ id: request.client.id, lat: request.client.lat, lng: request.client.lng, label: request.client.name }]}
          height={360}
          zoom={14}
        />
      </div>
    </div>
  );
}
