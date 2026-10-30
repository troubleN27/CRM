import type { Client, Employee, Request } from"@prisma/client";
import { getTranslations } from"next-intl/server";
import { Link } from"@/i18n/navigation";
import { isOverdue } from"@/lib/requests";
import { dateOnly, todayInOffice } from"@/lib/time";
import { requestStatusColor } from"./ui";

type Row = Request & { client: Client; assignee: Employee | null };

export async function RequestsTable({ requests, showClient = true }: { requests: Row[]; showClient?: boolean }) {
  const t = await getTranslations();
  const today = todayInOffice();

  if (requests.length === 0) {
    return <p className="rounded-lg border border-line bg-surface p-4 text-sm text-fg-2">{t("requests.empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-fg-2">
          <tr>
            <th className="px-4 py-3">№</th>
            {showClient && <th className="px-4 py-3">{t("requests.client")}</th>}
            <th className="px-4 py-3">{t("requests.description")}</th>
            <th className="px-4 py-3">{t("requests.assignee")}</th>
            <th className="px-4 py-3">{t("requests.dueDate")}</th>
            <th className="px-4 py-3">{t("requests.status")}</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => {
            const due = r.dueDate ? dateOnly(r.dueDate) : null;
            const overdue = isOverdue(r.status, due, today);
            return (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/requests/${r.id}`} className="font-medium text-brand-fg hover:underline">
                    #{r.number}
                  </Link>
                </td>
                {showClient && <td className="px-4 py-3">{r.client.name}</td>}
                <td className="px-4 py-3">
                  <Link href={`/requests/${r.id}`} className="hover:underline">
                    {r.description}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {r.assignee ? `${r.assignee.firstName} ${r.assignee.lastName}` : <span className="text-fg-3">—</span>}
                </td>
                <td className={`whitespace-nowrap px-4 py-3 ${overdue ? "font-medium text-danger" : ""}`}>
                  {due ?? "—"}
                  {overdue &&` · ${t("requests.overdue")}`}
                </td>
                <td className="px-4 py-3">
                  <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs ${requestStatusColor[r.status]}`}>
                    {t(`requestStatus.${r.status}`)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
