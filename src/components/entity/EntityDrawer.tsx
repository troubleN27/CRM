"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter as useNextRouter } from "next/navigation";
import { Drawer } from "vaul";
import { updateClientField, updateRequestField } from "@/app/[locale]/(app)/entity-actions";
import { Link } from "@/i18n/navigation";
import type { ClientEntity, RequestEntity, TimelineItem } from "@/lib/entities";
import { Icon } from "../icons";
import { badgeClass, linkClass, requestStatusColor } from "../ui";
import { InlineField } from "./InlineField";

export type EntityRef = { type: "request" | "client"; id: string } | null;

// Карточка сущности: выезжает справа, фон чуть уменьшается (scale 0.98).
// Слева (40%) — поля с правкой «на лету», справа (60%) — единая история изменений.
export function EntityDrawer({ entity, onClose }: { entity: EntityRef; onClose: () => void }) {
  const t = useTranslations();
  const router = useNextRouter();
  const [data, setData] = useState<RequestEntity | ClientEntity | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!entity) return;
    const res = await fetch(`/api/entities/${entity.type}/${entity.id}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      setData(await res.json());
      setError(false);
    } else setError(true);
  }, [entity]);

  useEffect(() => {
    if (!entity) return;
    const id = setTimeout(() => {
      setData(null);
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [entity, load]);

  // После сохранения — обновить карточку и страницу под ней.
  const saved = async (res: { ok: boolean; error?: string }) => {
    if (res.ok) {
      await load();
      router.refresh();
    }
    return res;
  };

  return (
    <Drawer.Root direction="right" open={Boolean(entity)} onOpenChange={(o) => !o && onClose()} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-canvas/70" />
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[1100px] flex-col border-l border-line-strong bg-surface outline-none md:w-[92vw]"
        >
          <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5">
            <Drawer.Title className="flex-1 truncate text-sm font-medium text-fg">
              {data?.type === "request" ? `${t("requests.one")} #${data.number}` : data?.type === "client" ? data.name : t("entity.loading")}
            </Drawer.Title>
            {data && (
              <Link href={data.type === "request" ? `/requests/${data.id}` : `/clients/${data.id}`} className={`${linkClass} text-xs`} onClick={onClose}>
                {t("entity.openPage")}
              </Link>
            )}
            <button type="button" onClick={onClose} aria-label={t("entity.close")} className="flex h-8 w-8 items-center justify-center rounded text-fg-2 hover:bg-pressed hover:text-fg">
              <Icon name="close" />
            </button>
          </div>

          <div data-lenis-prevent className="grid flex-1 overflow-hidden md:grid-cols-[2fr_3fr]">
            <section className="overflow-y-auto border-b border-line p-5 md:border-b-0 md:border-r">
              {error && <p className="text-sm text-danger">{t("entity.loadError")}</p>}
              {!data && !error && <FieldsSkeleton />}
              {data?.type === "request" && <RequestFields data={data} onSaved={saved} />}
              {data?.type === "client" && <ClientFields data={data} onSaved={saved} />}
            </section>
            <section className="overflow-y-auto p-5">
              <h3 className="mb-3 text-xs uppercase tracking-wide text-fg-2">{t("entity.timeline")}</h3>
              {data ? <Timeline items={data.timeline} created={data.createdAt} timeZone={data.timeZone} /> : <FieldsSkeleton />}
            </section>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function FieldsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="skeleton h-9" />
      ))}
    </div>
  );
}

type Saved = (res: { ok: boolean; error?: string }) => Promise<{ ok: boolean; error?: string }>;

function RequestFields({ data, onSaved }: { data: RequestEntity; onSaved: Saved }) {
  const t = useTranslations();
  const save = (field: Parameters<typeof updateRequestField>[1]) => async (v: string) => onSaved(await updateRequestField(data.id, field, v));
  return (
    <div>
      <InlineField
        label={t("requests.status")}
        value={data.status}
        kind="select"
        editable={data.statusOptions.length > 1}
        options={data.statusOptions.map((s) => ({ value: s, label: t(`requestStatus.${s}`) }))}
        display={<span className={`${badgeClass} ${requestStatusColor[data.status]}`}>{t(`requestStatus.${data.status}`)}</span>}
        onSave={save("status")}
      />
      <InlineField
        label={t("requests.assignee")}
        value={data.assigneeId ?? ""}
        kind="select"
        editable={data.canEdit}
        options={[{ value: "", label: t("requests.notAssigned") }, ...data.employees.map((e) => ({ value: e.id, label: e.name }))]}
        display={data.assignee ?? t("requests.notAssigned")}
        onSave={save("assigneeId")}
      />
      <InlineField label={t("requests.dueDate")} value={data.dueDate ?? ""} kind="date" mono editable={data.canEdit} onSave={save("dueDate")} />
      <InlineField label={t("requests.description")} value={data.description} kind="textarea" editable={data.canEdit} onSave={save("description")} />
      <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5">
        <span className="pt-0.5 text-xs uppercase tracking-wide text-fg-2">{t("requests.client")}</span>
        <div className="space-y-0.5 px-2 text-sm">
          <div className="text-fg">{data.client.name}</div>
          <div className="num text-fg-2">{data.client.phone}</div>
          <div className="text-fg-2">{data.client.address}</div>
        </div>
      </div>
    </div>
  );
}

function ClientFields({ data, onSaved }: { data: ClientEntity; onSaved: Saved }) {
  const t = useTranslations();
  const save = (field: "name" | "phone" | "address") => async (v: string) => onSaved(await updateClientField(data.id, field, v));
  return (
    <div className="space-y-5">
      <div>
        <InlineField label={t("clients.name")} value={data.name} editable={data.canEdit} onSave={save("name")} />
        <InlineField label={t("clients.phone")} value={data.phone} mono editable={data.canEdit} onSave={save("phone")} />
        <InlineField label={t("clients.address")} value={data.address} editable={data.canEdit} onSave={save("address")} />
      </div>
      <div>
        <h3 className="mb-2 text-xs uppercase tracking-wide text-fg-2">{t("requests.title")}</h3>
        <ul className="divide-y divide-line rounded border border-line">
          {data.requests.length === 0 && <li className="px-3 py-2 text-sm text-fg-2">{t("requests.empty")}</li>}
          {data.requests.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="num text-fg-2">#{r.number}</span>
              <span className="min-w-0 flex-1 truncate text-fg">{r.description}</span>
              <span className={`${badgeClass} ${requestStatusColor[r.status]}`}>{t(`requestStatus.${r.status}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Единая лента истории: появление записей — с небольшим каскадом.
function Timeline({ items, created, timeZone }: { items: TimelineItem[]; created: string; timeZone: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale, { timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const value = (field: string, v: string | null) => (v === null ? "—" : field === "status" ? t(`requestStatus.${v}`) : v);
  const who = (i: TimelineItem) => (i.byAgent ? t("entity.agent") : (i.actor ?? t("entity.system")));

  const text = (i: TimelineItem) => {
    switch (i.kind) {
      case "created":
        return t("entity.created", { who: who(i) });
      case "requestCreated":
        return t("entity.requestCreated", { number: i.number, who: who(i) });
      case "visit":
        return t(i.phase === "out" ? "entity.visitOut" : "entity.visitBack", { employee: i.employee });
      case "change":
        return t("entity.changed", { who: who(i), field: t(`entity.field.${i.field}`), from: value(i.field, i.from), to: value(i.field, i.to) });
    }
  };

  const list = items.length ? items : [{ id: "seed", at: created, actor: null, byAgent: false, kind: "created" as const }];
  return (
    <ol className="relative space-y-0 border-l border-line pl-5">
      <AnimatePresence initial>
        {list.map((i, n) => (
          <motion.li
            key={i.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(n, 12) * 0.035, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative pb-4"
          >
            <span className="absolute -left-[1.4rem] top-1.5 h-2 w-2 rounded-full border border-line-strong bg-elevated" />
            <div className="text-sm text-fg">{text(i)}</div>
            <div className="num text-xs text-fg-2">{when(i.at)}</div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
