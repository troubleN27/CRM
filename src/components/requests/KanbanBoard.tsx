"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion, useSpring } from "motion/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateRequestField } from "@/app/[locale]/(app)/entity-actions";
import { REQUEST_STATUSES } from "@/lib/requests";
import { badgeClass, requestStatusColor } from "../ui";
import type { RequestRow } from "./RequestsView";

type Status = (typeof REQUEST_STATUSES)[number];

// Канбан заявок по статусам. Перетаскивание (dnd-kit) мышью и с клавиатуры:
// Tab до карточки → Пробел «взять» → стрелки → Пробел «положить», Esc — отмена.
export function KanbanBoard({ rows, onOpen }: { rows: RequestRow[]; onOpen: (id: string) => void }) {
  const t = useTranslations();
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [active, setActive] = useState<RequestRow | null>(null);
  // Стабильный id: служебные подписи dnd-kit совпадают на сервере и в браузере.
  const dndId = useId();
  const lastX = useRef(0);
  // Наклон карточки зависит от скорости движения мыши; пружина возвращает её ровно.
  const tilt = useSpring(0, { stiffness: 300, damping: 20 });

  useEffect(() => {
    const id = setTimeout(() => setItems(rows), 0);
    return () => clearTimeout(id);
  }, [rows]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const onStart = (e: DragStartEvent) => {
    setActive(items.find((r) => r.id === e.active.id) ?? null);
    lastX.current = 0;
  };
  const onMove = (e: DragMoveEvent) => {
    const v = e.delta.x - lastX.current;
    lastX.current = e.delta.x;
    tilt.set(Math.max(-8, Math.min(8, v * 0.8)));
  };
  const onEnd = async (e: DragEndEvent) => {
    tilt.set(0);
    setActive(null);
    const row = items.find((r) => r.id === e.active.id);
    const to = e.over?.id as Status | undefined;
    if (!row || !to || to === row.status) return;
    if (!row.allowedStatuses.includes(to)) {
      toast.error(t(row.assigneeId || to === "NEW" ? "board.notAllowed" : "board.needAssignee"));
      return;
    }
    // Сразу переносим, при ошибке сервера — возвращаем.
    setItems((list) => list.map((r) => (r.id === row.id ? { ...r, status: to } : r)));
    const res = await updateRequestField(row.id, "status", to);
    if (res.ok) {
      toast.success(t("board.moved", { number: row.number, status: t(`requestStatus.${to}`) }));
      router.refresh();
    } else {
      setItems((list) => list.map((r) => (r.id === row.id ? { ...r, status: row.status } : r)));
      toast.error(t(`entity.errors.${res.error}`));
    }
  };

  return (
    <DndContext id={dndId} sensors={sensors} onDragStart={onStart} onDragMove={onMove} onDragEnd={onEnd} onDragCancel={() => {
        tilt.set(0);
        setActive(null);
      }}>
      <div data-lenis-prevent className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:px-0">
        {REQUEST_STATUSES.map((s) => (
          <Column key={s} status={s} rows={items.filter((r) => r.status === s)} onOpen={onOpen} activeId={active?.id ?? null} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {active && (
          <motion.div style={{ rotate: tilt }} className="cursor-grabbing">
            <Card row={active} lifted />
          </motion.div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Column({ status, rows, onOpen, activeId }: { status: Status; rows: RequestRow[]; onOpen: (id: string) => void; activeId: string | null }) {
  const t = useTranslations();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={t(`requestStatus.${status}`)}
      className={`flex min-h-[60vh] w-[280px] shrink-0 snap-start flex-col rounded-lg border bg-surface transition-colors duration-150 sm:w-[300px] ${
        isOver ? "border-line-strong bg-elevated" : "border-line"
      }`}
    >
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span className={`${badgeClass} ${requestStatusColor[status]}`}>{t(`requestStatus.${status}`)}</span>
        <span className="num ml-auto text-xs text-fg-2">{rows.length}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {rows.map((r) => (
          <DraggableCard key={r.id} row={r} onOpen={onOpen} hidden={activeId === r.id} />
        ))}
        {rows.length === 0 && <p className="px-2 py-6 text-center text-xs text-fg-3">{t("board.empty")}</p>}
      </div>
    </section>
  );
}

function DraggableCard({ row, onOpen, hidden }: { row: RequestRow; onOpen: (id: string) => void; hidden: boolean }) {
  const t = useTranslations("board");
  // Без ответственного карточку тоже можно взять — при отпускании объясним, что сначала нужно назначить.
  const canDrag = row.allowedStatuses.length > 1 || !row.assigneeId;
  const { setNodeRef, attributes, listeners } = useDraggable({ id: row.id, disabled: !canDrag });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription={t("card")}
      onClick={() => onOpen(row.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter") onOpen(row.id);
      }}
      className={`select-none rounded-md outline-none focus-visible:ring-1 focus-visible:ring-line-strong ${hidden ? "opacity-30" : ""} ${canDrag ? "cursor-grab" : "cursor-pointer"}`}
    >
      <Card row={row} />
    </div>
  );
}

function Card({ row, lifted }: { row: RequestRow; lifted?: boolean }) {
  const t = useTranslations();
  return (
    <article className={`space-y-2 rounded-md border p-3 text-sm transition-colors duration-150 ${lifted ? "border-line-strong bg-pressed" : "border-line bg-elevated hover:border-line-strong"}`}>
      <div className="flex items-center gap-2">
        <span className="num text-xs text-fg-2">#{row.number}</span>
        <span className="truncate text-xs text-fg-2">{row.client}</span>
      </div>
      <p className="line-clamp-2 text-fg">{row.description}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="truncate text-fg-2">{row.assignee ?? t("requests.notAssigned")}</span>
        {row.dueDate && <span className={`num ml-auto ${row.overdue ? "text-danger" : "text-fg-2"}`}>{row.dueDate}</span>}
      </div>
    </article>
  );
}
