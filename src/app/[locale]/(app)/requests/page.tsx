import type { Prisma } from "@prisma/client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { RequestsView, type RequestRow } from "@/components/requests/RequestsView";
import { buttonClass, pageTitleClass } from "@/components/ui";
import { db } from "@/lib/db";
import { canManageRequests, canSetStatus, isOverdue, isRequestStatus, REQUEST_STATUSES } from "@/lib/requests";
import { requireUser } from "@/lib/session";
import { dateOnly, todayInOffice } from "@/lib/time";

export default async function RequestsPage({ params, searchParams }: PageProps<"/[locale]/requests">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations();

  // Фильтр и вид в адресе: ?status=IN_PROGRESS&mine=1&view=board
  const sp = await searchParams;
  const status = isRequestStatus(sp.status) ? sp.status : null;
  const mine = sp.mine === "1";
  const view = sp.view === "board" ? "board" : "table";
  const canManage = canManageRequests(user.role);

  // На доске нужны все статусы — фильтр по статусу там не применяется.
  const where: Prisma.RequestWhereInput = {
    ...(status && view === "table" && { status }),
    ...(mine && { assigneeId: user.employeeId }),
  };
  const [requests, counts, employees] = await Promise.all([
    db.request.findMany({ where, include: { client: true, assignee: true }, orderBy: { number: "desc" } }),
    db.request.groupBy({ by: ["status"], where: mine ? { assigneeId: user.employeeId } : {}, _count: true }),
    canManage ? db.employee.findMany({ where: { isActive: true }, orderBy: [{ lastName: "asc" }] }) : Promise.resolve([]),
  ]);
  const today = todayInOffice();

  const rows: RequestRow[] = requests.map((r) => {
    const due = r.dueDate ? dateOnly(r.dueDate) : null;
    return {
      id: r.id,
      number: r.number,
      client: r.client.name,
      description: r.description,
      assignee: r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : null,
      assigneeId: r.assigneeId,
      dueDate: due,
      overdue: isOverdue(r.status, due, today),
      status: r.status,
      allowedStatuses: REQUEST_STATUSES.filter((s) => s === r.status || canSetStatus(user, r.assigneeId, s)),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className={pageTitleClass}>{t("requests.title")}</h1>
        {canManage && (
          <Link href="/requests/new" className={`${buttonClass} ml-auto`}>
            {t("requests.add")}
          </Link>
        )}
      </div>
      <RequestsView
        rows={rows}
        view={view}
        status={status}
        mine={mine}
        counts={Object.fromEntries(counts.map((c) => [c.status, c._count]))}
        total={counts.reduce((s, c) => s + c._count, 0)}
        canManage={canManage}
        employees={employees.map((e) => ({ id: e.id, name: `${e.lastName} ${e.firstName}` }))}
      />
    </div>
  );
}
