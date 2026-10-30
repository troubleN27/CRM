"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Icon } from "../icons";

type Props<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId: (row: T) => string;
  searchPlaceholder: string;
  emptyText: string;
  initialQuery?: string;
  initialSort?: SortingState;
  // Раскрытие строки (аккордеон) для быстрого просмотра без ухода со страницы.
  renderExpanded?: (row: T) => ReactNode;
  // Открыть карточку (клик по строке или Enter).
  onOpen?: (row: T) => void;
  // Мультивыбор: панель массовых действий выезжает снизу.
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  toolbar?: ReactNode;
  maxHeight?: string;
};

const ROW_HEIGHT = 44;

// Универсальная таблица: виртуализированные строки (TanStack Table + Virtual), закреплённая шапка,
// сортировка, поиск, раскрытие строки, мультивыбор. Всё доступно с клавиатуры:
// стрелки — по строкам, Enter — открыть, Пробел — выбрать, → / ← — раскрыть / свернуть.
export function DataGrid<T>(props: Props<T>) {
  const t = useTranslations("grid");
  const [sorting, setSorting] = useState<SortingState>(props.initialSort ?? []);
  const [query, setQuery] = useState(props.initialQuery ?? "");
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectable = Boolean(props.bulkActions);

  const columns = useMemo<ColumnDef<T, unknown>[]>(() => {
    const extra: ColumnDef<T, unknown>[] = [];
    if (selectable) {
      extra.push({
        id: "_select",
        enableSorting: false,
        size: 40,
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label={t("selectAll")}
            className="h-3.5 w-3.5 accent-brand"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={t("selectRow")}
            className="h-3.5 w-3.5 accent-brand"
            checked={row.getIsSelected()}
            onClick={(e) => e.stopPropagation()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
      });
    }
    if (props.renderExpanded) {
      extra.push({
        id: "_expand",
        enableSorting: false,
        size: 36,
        header: () => <span className="sr-only">{t("expand")}</span>,
        cell: ({ row }) => (
          <button
            type="button"
            tabIndex={-1}
            aria-label={expanded[row.id] ? t("collapse") : t("expand")}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((s) => ({ ...s, [row.id]: !s[row.id] }));
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-fg-2 hover:bg-pressed hover:text-fg"
          >
            <motion.span animate={{ rotate: expanded[row.id] ? 90 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} className="flex">
              <Icon name="chevronRight" size={14} />
            </motion.span>
          </button>
        ),
      });
    }
    return [...extra, ...props.columns];
  }, [props.columns, props.renderExpanded, selectable, expanded, t]);

  const table = useReactTable({
    data: props.data,
    columns,
    getRowId: props.getRowId,
    state: { sorting, globalFilter: query, rowSelection: selection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setQuery,
    onRowSelectionChange: setSelection,
    enableRowSelection: selectable,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getItemKey: (i) => rows[i].id,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;
  const colCount = table.getVisibleLeafColumns().length;

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const clear = () => setSelection({});

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, index: number) => {
    const row = rows[index];
    const focusRow = (i: number) => {
      if (i < 0 || i >= rows.length) return;
      virtualizer.scrollToIndex(i);
      requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLElement>(`[data-row-index="${i}"]`)?.focus());
    };
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      focusRow(index + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter" && props.onOpen) props.onOpen(row.original);
    else if (e.key === " " && selectable) {
      e.preventDefault();
      row.toggleSelected();
    } else if (e.key === "ArrowRight" && props.renderExpanded) setExpanded((s) => ({ ...s, [row.id]: true }));
    else if (e.key === "ArrowLeft" && props.renderExpanded) setExpanded((s) => ({ ...s, [row.id]: false }));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex min-w-56 flex-1 items-center sm:max-w-xs">
          <Icon name="search" className="pointer-events-none absolute left-3 text-fg-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={props.searchPlaceholder}
            className="h-9 w-full rounded border border-line bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-fg-3 transition-colors hover:border-line-strong focus:border-line-strong focus:outline-none"
          />
        </label>
        <span className="num text-xs text-fg-2">{t("rows", { count: rows.length })}</span>
        {props.toolbar && <div className="ml-auto flex flex-wrap items-center gap-2">{props.toolbar}</div>}
      </div>

      <div ref={scrollRef} data-lenis-prevent className="overflow-auto rounded-lg border border-line bg-surface" style={{ maxHeight: props.maxHeight ?? "70vh" }}>
        <table className="w-full border-collapse text-left text-sm" role="grid" aria-rowcount={rows.length}>
          <thead className="sticky top-0 z-10 bg-surface">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line">
                {hg.headers.map((h) => {
                  const sort = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      style={{ width: h.column.columnDef.size }}
                      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined}
                      className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-fg-2"
                    >
                      {h.column.getCanSort() ? (
                        <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 uppercase transition-colors hover:text-fg">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <span className="num text-[10px] text-fg-3">{sort === "asc" ? "▲" : sort === "desc" ? "▼" : ""}</span>
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          {padTop > 0 && (
            <tbody aria-hidden>
              <tr style={{ height: padTop }} />
            </tbody>
          )}
          {items.map((vi) => {
            const row = rows[vi.index];
            const isOpen = Boolean(expanded[row.id]);
            return (
              <tbody key={row.id} ref={virtualizer.measureElement} data-index={vi.index}>
                <tr
                  tabIndex={0}
                  data-row-index={vi.index}
                  aria-selected={selectable ? row.getIsSelected() : undefined}
                  onKeyDown={(e) => onRowKey(e, vi.index)}
                  onClick={() => (props.onOpen ? props.onOpen(row.original) : props.renderExpanded && setExpanded((s) => ({ ...s, [row.id]: !s[row.id] })))}
                  className={`border-b border-line transition-colors duration-150 focus:bg-elevated focus:outline-none ${
                    row.getIsSelected() ? "bg-pressed" : "hover:bg-elevated"
                  } ${props.onOpen || props.renderExpanded ? "cursor-pointer" : ""}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                <AnimatePresence initial={false}>
                  {isOpen && props.renderExpanded && (
                    <tr className="border-b border-line bg-canvas">
                      <td colSpan={colCount} className="p-0">
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 320, damping: 34 }}
                          onAnimationComplete={() => virtualizer.measure()}
                          className="overflow-hidden"
                        >
                          <div className="px-4 py-3">{props.renderExpanded(row.original)}</div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            );
          })}
          {padBottom > 0 && (
            <tbody aria-hidden>
              <tr style={{ height: padBottom }} />
            </tbody>
          )}
          {rows.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={colCount} className="px-4 py-10 text-center text-sm text-fg-2">
                  {props.emptyText}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      {/* Плавающая панель массовых действий */}
      <AnimatePresence>
        {selected.length > 0 && props.bulkActions && (
          <motion.div
            role="toolbar"
            aria-label={t("bulkBar")}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-md border border-line-strong bg-elevated px-4 py-2.5 text-sm"
          >
            <span className="num text-fg">{t("selected", { count: selected.length })}</span>
            <span className="h-5 w-px bg-line-strong" />
            {props.bulkActions(selected, clear)}
            <button type="button" onClick={clear} className="flex h-7 w-7 items-center justify-center rounded text-fg-2 hover:bg-pressed hover:text-fg" aria-label={t("clearSelection")}>
              <Icon name="close" size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

