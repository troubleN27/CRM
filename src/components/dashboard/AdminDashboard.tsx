"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AdminDashboardData, FeedItem } from "@/lib/dashboard";
import { Icon, type IconName } from "../icons";
import { OfficeMiniMap } from "../office/OfficeMiniMap";
import type { PlanDesk, PlanImage, PlanZone } from "../office/PlanCanvas";
import { AttendanceChart, RequestsChart } from "./Charts";
import { NumberTicker } from "./NumberTicker";

const POLL_MS = 3000;
const ORDER_KEY = "office-crm:bento-order";

// Блоки Bento-сетки и их размер в 12-колоночной сетке.
const WIDGETS = {
  map: "lg:col-span-8",
  feed: "lg:col-span-4",
  attendance: "lg:col-span-7",
  requests: "lg:col-span-5",
} as const;
type WidgetId = keyof typeof WIDGETS;
const DEFAULT_ORDER: WidgetId[] = ["map", "feed", "attendance", "requests"];

const tiles = [
  { key: "inOffice", href: "/office", tone: "text-success" },
  { key: "outOfOffice", href: "/map", tone: "text-warning" },
  { key: "notArrived", href: null, tone: "text-fg" },
  { key: "late", href: null, tone: "text-danger" },
  { key: "inProgress", href: "/requests?status=IN_PROGRESS", tone: "text-brand-fg" },
] as const;

const feedStyle: Record<FeedItem["kind"], { icon: IconName; color: string }> = {
  checkIn: { icon: "arrowIn", color: "bg-success-bg text-success" },
  out: { icon: "arrowOut", color: "bg-warning-bg text-warning" },
  back: { icon: "arrowBack", color: "bg-info-bg text-info" },
  endOfDay: { icon: "stop", color: "bg-pressed text-fg-2" },
  assigned: { icon: "check", color: "bg-pressed text-brand-fg" },
};

// Главная админа в стиле Bento: цифры, мини-карта офиса, лента событий, графики.
// Обновляется сама каждые 3 секунды; порядок блоков можно поменять перетаскиванием («Настроить»).
export function AdminDashboard(props: { initial: AdminDashboardData; plan: PlanImage | null; zones: PlanZone[]; desks: PlanDesk[] }) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [data, setData] = useState(props.initial);
  const [offline, setOffline] = useState(false);
  const [order, setOrder] = useState<WidgetId[]>(DEFAULT_ORDER);
  const [customizing, setCustomizing] = useState(false);
  const kpiRef = useRef<HTMLDivElement>(null);
  const dndId = useId();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "null") as WidgetId[] | null;
      if (saved && saved.length === DEFAULT_ORDER.length && saved.every((w) => w in WIDGETS)) setTimeout(() => setOrder(saved), 0);
    } catch {}
  }, []);

  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/dashboard?locale=${locale}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as AdminDashboardData;
        if (!stopped) {
          setData(next);
          setOffline(false);
        }
      } catch {
        if (!stopped) setOffline(true);
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [locale]);

  // Микро-параллакс: при прокрутке плитки с цифрами сдвигаются чуть медленнее (до 12px).
  useGSAP(
    () => {
      if (!kpiRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.registerPlugin(ScrollTrigger);
      gsap.to(kpiRef.current, { y: 12, ease: "none", scrollTrigger: { trigger: kpiRef.current, start: "top top+=56", end: "+=400", scrub: true } });
    },
    { scope: kpiRef },
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setOrder((o) => {
      const next = arrayMove(o, o.indexOf(e.active.id as WidgetId), o.indexOf(e.over!.id as WidgetId));
      try {
        localStorage.setItem(ORDER_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const feedText = (f: FeedItem) => {
    switch (f.kind) {
      case "out":
        return t("feedOut", { name: f.name, reason: f.reason ? t(`reason.${f.reason}`) : "" }) + (f.request ? ` · #${f.request.number}` : "");
      case "assigned":
        return t(f.byAgent ? "feedAssignedByAgent" : "feedAssigned", { number: f.request?.number ?? 0, client: f.request?.client ?? "", assignee: f.assignee ?? "", by: f.name });
      default:
        return t(`feed.${f.kind}`, { name: f.name });
    }
  };

  const widgets: Record<WidgetId, { title: string; extra?: ReactNode; body: ReactNode }> = {
    map: {
      title: t("miniMapTitle"),
      extra: (
        <span className="flex items-center gap-2 text-xs text-fg-2">
          <span className={`h-1.5 w-1.5 rounded-full ${offline ? "bg-danger" : "animate-pulse bg-success"}`} />
          {offline ? t("offline") : t("updatedAt", { time: data.updatedAt })}
        </span>
      ),
      body: (
        <>
          {props.plan ? (
            <OfficeMiniMap plan={props.plan} zones={props.zones} desks={props.desks} people={data.people} />
          ) : (
            <p className="rounded border border-line bg-warning-bg p-3 text-sm text-warning">{t("noPlan")}</p>
          )}
          <p className="mt-2 text-xs text-fg-2">{t("miniMapHint", { count: data.people.length })}</p>
        </>
      ),
    },
    feed: {
      title: t("feedTitle"),
      body: (
        // Лента не растягивает строку сетки: её высота = высоте мини-карты, остальное прокручивается.
        <div className="relative min-h-64 flex-1">
          <ol data-testid="feed" data-lenis-prevent className="absolute inset-0 -mr-2 space-y-3 overflow-y-auto pr-2">
            {data.feed.length === 0 && <li className="text-sm text-fg-2">{t("feedEmpty")}</li>}
            {data.feed.map((f) => (
              <li key={f.id} className="flex gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${feedStyle[f.kind].color}`}>
                  <Icon name={feedStyle[f.kind].icon} size={13} />
                </span>
                <div className="min-w-0 text-sm">
                  <div className="text-fg">{feedText(f)}</div>
                  <div className="num text-xs text-fg-2">{f.isToday ? f.time : `${f.date} · ${f.time}`}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ),
    },
    attendance: { title: t("chartAttendance"), body: <AttendanceChart data={data.attendance} /> },
    requests: { title: t("chartRequests"), body: <RequestsChart data={data.requestsByStatus} /> },
  };

  return (
    <div className="space-y-3">
      <div ref={kpiRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => {
          const body = (
            <div data-testid={`stat-${tile.key}`} className="h-full rounded-lg border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-elevated">
              <div className="text-xs uppercase tracking-wide text-fg-2">{t(`stat.${tile.key}`)}</div>
              <NumberTicker value={data.stats[tile.key]} className={`mt-2 block text-3xl ${tile.tone}`} />
            </div>
          );
          return tile.href ? (
            <Link key={tile.key} href={tile.href} className="block">
              {body}
            </Link>
          ) : (
            <div key={tile.key}>{body}</div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCustomizing((c) => !c)}
          aria-pressed={customizing}
          className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs transition-colors ${customizing ? "border-line-strong bg-pressed text-fg" : "border-line text-fg-2 hover:text-fg"}`}
        >
          <Icon name="settings" size={14} />
          {customizing ? t("customizeDone") : t("customize")}
        </button>
      </div>

      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid auto-rows-min grid-cols-1 gap-3 lg:grid-cols-12">
            {order.map((id) => (
              <BentoCard key={id} id={id} className={WIDGETS[id]} title={widgets[id].title} extra={widgets[id].extra} customizing={customizing}>
                {widgets[id].body}
              </BentoCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function BentoCard({ id, className, title, extra, customizing, children }: { id: WidgetId; className: string; title: string; extra?: ReactNode; customizing: boolean; children: ReactNode }) {
  const t = useTranslations("dashboard");
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id, disabled: !customizing });
  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${className} flex flex-col rounded-lg border bg-surface p-4 ${isDragging ? "z-20 border-line-strong bg-elevated" : "border-line"} ${customizing ? "ring-1 ring-line-strong ring-offset-2 ring-offset-canvas" : ""}`}
    >
      <header className="mb-3 flex items-center gap-2">
        {customizing && (
          <button type="button" {...attributes} {...listeners} aria-label={t("dragWidget", { title })} className="flex h-6 w-6 cursor-grab items-center justify-center rounded text-fg-2 hover:bg-pressed hover:text-fg">
            <Icon name="grip" size={14} />
          </button>
        )}
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        <div className="ml-auto">{extra}</div>
      </header>
      {children}
    </section>
  );
}
