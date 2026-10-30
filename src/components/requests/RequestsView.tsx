"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { LayoutGroup, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bulkUpdateRequests } from "@/app/[locale]/(app)/entity-actions";
import { Link } from "@/i18n/navigation";
import { REQUEST_STATUSES } from "@/lib/requests";
import { EntityDrawer, type EntityRef } from "../entity/EntityDrawer";
import { DataGrid } from "../grid/DataGrid";
import { Icon } from "../icons";
import { badgeClass, requestStatusColor } from "../ui";
import { KanbanBoard } from "./KanbanBoard";

export type RequestRow = {
  id: string;
  number: number;
  client: string;
  description: string;
  assignee: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  overdue: boolean;
  status: (typeof REQUEST_STATUSES)[number];
  allowedStatuses: (typeof REQUEST_STATUSES)[number][];
};

type Props = {
  rows: RequestRow[];
  view: "table" | "board";
  status: string | null;
  mine: boolean;
  counts: Record<string, number>;
  total: number;
  canManage: boolean;
  employees: { id: string; name: string }[];
};

// Заявки: вкладки статусов, переключатель «Таблица / Доска», выезжающая карточка заявки.
export function RequestsView(props: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [entity, setEntity] = useState<EntityRef>(null);
  const open = (id: string) => setEntity({ type: "request", id });

  const href = (o: { status?: string | null; mine?: boolean; view?: string }) => {
    const q = new URLSearchParams();
    const status = o.status === undefined ? props.status : o.status;
    const mine = o.mine ?? props.mine;
    const view = o.view ?? props.view;
    if (status) q.set("status", status);
    if (mine) q.set("mine", "1");
    if (view === "board") q.set("view", "board");
    const qs = q.toString();
    return qs ? `/requests?${qs}` : "/requests";
  };

  const columns = useMemo<ColumnDef<RequestRow, unknown>[]>(
    () => [
      { id: "number", accessorKey: "number", header: "№", size: 70, cell: ({ getValue }) => <span className="num text-fg-2">#{String(getValue())}</span> },
      { id: "client", accessorKey: "client", header: t("requests.client") },
      { id: "description", accessorKey: "description", header: t("requests.description"), cell: ({ getValue }) => <span className="line-clamp-1 text-fg">{String(getValue())}</span> },
      { id: "assignee", accessorFn: (r) => r.assignee ?? "", header: t("requests.assignee"), cell: ({ row }) => row.original.assignee ?? <span className="text-fg-3">—</span> },
      {
        id: "dueDate",
        accessorFn: (r) => r.dueDate ?? "",
        header: t("requests.dueDate"),
        cell: ({ row }) => (
          <span className={`num whitespace-nowrap ${row.original.overdue ? "text-danger" : ""}`}>
            {row.original.dueDate ?? "—"}
            {row.original.overdue && ` · ${t("requests.overdue")}`}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => REQUEST_STATUSES.indexOf(r.status),
        header: t("requests.status"),
        cell: ({ row }) => <span className={`${badgeClass} ${requestStatusColor[row.original.status]}`}>{t(`requestStatus.${row.original.status}`)}</span>,
      },
    ],
    [t],
  );

  const bulk = async (ids: string[], change: { assigneeId: string } | { status: string }, clear: () => void) => {
    const res = await bulkUpdateRequests(ids, change);
    if (res.updated) toast.success(t("grid.bulkDone", { updated: res.updated }));
    if (res.skipped) toast.error(t("grid.bulkSkipped", { skipped: res.skipped }));
    clear();
    router.refresh();
  };

  const tab = (active: boolean) =>
    `relative rounded px-3 py-1.5 text-sm transition-colors duration-150 ${active ? "text-fg" : "text-fg-2 hover:text-fg"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <LayoutGroup id="request-tabs">
          <nav aria-label={t("requests.filter")} className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-surface p-1">
            {[null, ...REQUEST_STATUSES].map((s) => {
              const active = props.status === s;
              return (
                <Link key={s ?? "all"} href={href({ status: s })} className={tab(active)}>
                  {active && <motion.span layoutId="tab-indicator" className="absolute inset-0 rounded bg-pressed" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                  <span className="relative">
                    {s ? t(`requestStatus.${s}`) : t("requests.all")} <span className="num text-fg-3">{s ? (props.counts[s] ?? 0) : props.total}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>
        <Link href={href({ mine: !props.mine })} className={`rounded border px-3 py-1.5 text-sm transition-colors ${props.mine ? "border-line-strong bg-pressed text-fg" : "border-line text-fg-2 hover:text-fg"}`}>
          {t("requests.mine")}
        </Link>
        <div className="ml-auto flex rounded-md border border-line bg-surface p-1" role="group" aria-label={t("board.view")}>
          {(["table", "board"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              aria-pressed={props.view === v}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm transition-colors ${props.view === v ? "bg-pressed text-fg" : "text-fg-2 hover:text-fg"}`}
            >
              <Icon name={v === "table" ? "table" : "board"} />
              {t(`board.${v}`)}
            </Link>
          ))}
        </div>
      </div>

      {props.view === "board" ? (
        <KanbanBoard rows={props.rows} onOpen={open} />
      ) : (
        <DataGrid
          data={props.rows}
          columns={columns}
          getRowId={(r) => r.id}
          initialSort={[{ id: "number", desc: true }]}
          searchPlaceholder={t("grid.searchRequests")}
          emptyText={t("requests.empty")}
          onOpen={(r) => open(r.id)}
          renderExpanded={(r) => (
            <p className="max-w-3xl whitespace-pre-line text-sm text-fg">
              <span className="text-fg-2">{r.client} · </span>
              {r.description}
            </p>
          )}
          bulkActions={
            props.canManage
              ? (selected, clear) => (
                  <>
                    <select
                      aria-label={t("grid.bulkAssign")}
                      defaultValue=""
                      onChange={(e) => e.target.value && bulk(selected.map((s) => s.id), { assigneeId: e.target.value }, clear)}
                      className="h-8 rounded border border-line bg-surface px-2 text-sm text-fg"
                    >
                      <option value="">{t("grid.bulkAssign")}</option>
                      {props.employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={t("grid.bulkStatus")}
                      defaultValue=""
                      onChange={(e) => e.target.value && bulk(selected.map((s) => s.id), { status: e.target.value }, clear)}
                      className="h-8 rounded border border-line bg-surface px-2 text-sm text-fg"
                    >
                      <option value="">{t("grid.bulkStatus")}</option>
                      {REQUEST_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`requestStatus.${s}`)}
                        </option>
                      ))}
                    </select>
                  </>
                )
              : undefined
          }
        />
      )}

      <EntityDrawer entity={entity} onClose={() => setEntity(null)} />
    </div>
  );
}
