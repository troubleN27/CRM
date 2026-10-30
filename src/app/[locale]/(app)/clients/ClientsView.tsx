"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { EntityDrawer, type EntityRef } from "@/components/entity/EntityDrawer";
import { DataGrid } from "@/components/grid/DataGrid";
import { badgeClass, requestStatusColor } from "@/components/ui";

export type ClientRow = {
  id: string;
  name: string;
  phone: string;
  address: string;
  openRequests: number;
  requests: { number: number; description: string; status: keyof typeof requestStatusColor }[];
};

// Клиенты: универсальная таблица и выезжающая карточка клиента.
export function ClientsView({ rows }: { rows: ClientRow[] }) {
  const t = useTranslations();
  const [entity, setEntity] = useState<EntityRef>(null);

  const columns = useMemo<ColumnDef<ClientRow, unknown>[]>(
    () => [
      { id: "name", accessorKey: "name", header: t("clients.name"), cell: ({ getValue }) => <span className="text-fg">{String(getValue())}</span> },
      { id: "phone", accessorKey: "phone", header: t("clients.phone"), cell: ({ getValue }) => <span className="num whitespace-nowrap">{String(getValue())}</span> },
      { id: "address", accessorKey: "address", header: t("clients.address") },
      { id: "open", accessorKey: "openRequests", header: t("clients.openRequests"), cell: ({ getValue }) => <span className="num">{String(getValue())}</span> },
    ],
    [t],
  );

  return (
    <>
      <DataGrid
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        initialSort={[{ id: "name", desc: false }]}
        searchPlaceholder={t("grid.searchClients")}
        emptyText={t("grid.empty")}
        onOpen={(r) => setEntity({ type: "client", id: r.id })}
        renderExpanded={(r) =>
          r.requests.length ? (
            <ul className="space-y-1.5 text-sm">
              {r.requests.map((q) => (
                <li key={q.number} className="flex items-center gap-3">
                  <span className="num text-fg-2">#{q.number}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{q.description}</span>
                  <span className={`${badgeClass} ${requestStatusColor[q.status]}`}>{t(`requestStatus.${q.status}`)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-fg-2">{t("requests.empty")}</p>
          )
        }
      />
      <EntityDrawer entity={entity} onClose={() => setEntity(null)} />
    </>
  );
}
