"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { DataGrid } from "@/components/grid/DataGrid";
import { Link, useRouter } from "@/i18n/navigation";
import { badgeClass, linkClass, statusColor } from "@/components/ui";

export type EmployeeRow = {
  id: string;
  name: string;
  position: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  login: string | null; // только для админа
  desk: string | null;
  pc: string | null;
  status: keyof typeof statusColor;
  phone: string | null;
  email: string | null;
  activeRequests: number;
  canEdit: boolean;
};

const roleOrder = { ADMIN: 0, MANAGER: 1, EMPLOYEE: 2 } as const;

export function EmployeesGrid({ rows, showLogin, initialQuery }: { rows: EmployeeRow[]; showLogin: boolean; initialQuery?: string }) {
  const t = useTranslations();
  const router = useRouter();

  const columns = useMemo<ColumnDef<EmployeeRow, unknown>[]>(() => {
    const cols: ColumnDef<EmployeeRow, unknown>[] = [
      { id: "name", accessorKey: "name", header: t("employees.name"), cell: ({ getValue }) => <span className="text-fg">{String(getValue())}</span> },
      { id: "position", accessorKey: "position", header: t("employees.position") },
      {
        id: "role",
        accessorFn: (r) => t(`roles.${r.role}`),
        header: t("employees.role"),
        sortingFn: (a, b) => roleOrder[a.original.role] - roleOrder[b.original.role],
      },
    ];
    if (showLogin) cols.push({ id: "login", accessorKey: "login", header: t("employees.login"), cell: ({ getValue }) => <span className="num text-xs text-fg-2">{String(getValue() ?? "")}</span> });
    cols.push(
      { id: "desk", accessorKey: "desk", header: t("employees.desk"), cell: ({ getValue }) => <span className="num">{String(getValue() ?? "—")}</span> },
      {
        id: "status",
        accessorFn: (r) => t(`status.${r.status}`),
        header: t("employees.status"),
        cell: ({ row }) => <span className={`${badgeClass} ${statusColor[row.original.status]}`}>{t(`status.${row.original.status}`)}</span>,
      },
    );
    if (showLogin) {
      cols.push({
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">{t("common.edit")}</span>,
        cell: ({ row }) =>
          row.original.canEdit ? (
            <Link href={`/employees/${row.original.id}/edit`} onClick={(e) => e.stopPropagation()} className={linkClass}>
              {t("common.edit")}
            </Link>
          ) : null,
      });
    }
    return cols;
  }, [t, showLogin]);

  return (
    <DataGrid
      data={rows}
      columns={columns}
      getRowId={(r) => r.id}
      initialQuery={initialQuery}
      initialSort={[{ id: "role", desc: false }]}
      searchPlaceholder={t("grid.searchEmployees")}
      emptyText={t("grid.empty")}
      onOpen={(r) => (r.canEdit ? router.push(`/employees/${r.id}/edit`) : undefined)}
      renderExpanded={(r) => (
        <dl className="grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
          <dt className="text-fg-2">{t("grid.phone")}</dt>
          <dd className="num">{r.phone ?? "—"}</dd>
          <dt className="text-fg-2">{t("grid.email")}</dt>
          <dd className="num">{r.email ?? "—"}</dd>
          <dt className="text-fg-2">{t("employees.desk")}</dt>
          <dd className="num">{r.desk ? `${r.desk}${r.pc ? ` · ${r.pc}` : ""}` : "—"}</dd>
          <dt className="text-fg-2">{t("grid.activeRequests")}</dt>
          <dd className="num">{r.activeRequests}</dd>
        </dl>
      )}
    />
  );
}
