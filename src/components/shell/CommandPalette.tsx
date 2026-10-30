"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useTranslations } from "next-intl";
import { useRouter as useNextRouter } from "next/navigation";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { Icon, type IconName } from "../icons";
import type { NavItem } from "./AppShell";

type Results = {
  employees: { id: string; name: string; position: string; status: string }[];
  clients: { id: string; name: string; address: string }[];
  requests: { id: string; number: number; description: string; client: string }[];
};
type DayState = { checkedIn: boolean; ended: boolean; out: boolean } | null;

const itemClass =
  "flex h-10 cursor-pointer items-center gap-3 rounded px-3 text-sm text-fg-2 transition-colors duration-150 data-[selected=true]:bg-pressed data-[selected=true]:text-fg";

// Меню команд (Ctrl+K / Cmd+K): переходы по разделам, быстрые отметки и поиск.
export function CommandPalette({ open, onOpenChange, nav }: { open: boolean; onOpenChange: (v: boolean) => void; nav: NavItem[] }) {
  const t = useTranslations();
  const router = useRouter();
  const nextRouter = useNextRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [day, setDay] = useState<DayState>(null);

  // Ctrl+K / Cmd+K открывает и закрывает.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Состояние моего дня — чтобы показать нужные отметки.
  useEffect(() => {
    if (!open || nav.length === 0) return;
    let stop = false;
    fetch("/api/attendance", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !stop && d && setDay({ checkedIn: d.checkedIn, ended: d.ended, out: Boolean(d.out) }))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [open, nav.length]);

  // Поиск с задержкой 200 мс.
  useEffect(() => {
    if (query.trim().length < 2) return;
    const id = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setResults(await res.json());
    }, 200);
    return () => clearTimeout(id);
  }, [query]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
    setResults(null);
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const mark = async (action: "in" | "out" | "back" | "end", reason?: string) => {
    close();
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) toast.success(t(`shell.marked.${action}`));
    else toast.error(t("shell.markFailed"));
    nextRouter.refresh();
  };

  const actions: { key: string; icon: IconName; run: () => void }[] = [];
  if (day && !day.checkedIn) actions.push({ key: "in", icon: "arrowIn", run: () => mark("in") });
  if (day?.checkedIn && !day.ended && !day.out) {
    actions.push({ key: "lunch", icon: "arrowOut", run: () => mark("out", "LUNCH") });
    actions.push({ key: "personal", icon: "arrowOut", run: () => mark("out", "PERSONAL") });
  }
  if (day?.out) actions.push({ key: "back", icon: "arrowBack", run: () => mark("back") });
  if (day?.checkedIn && !day.ended) actions.push({ key: "end", icon: "stop", run: () => mark("end") });

  const showResults = query.trim().length >= 2 && results;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(v) => (v ? onOpenChange(true) : close())}
      label={t("shell.palette")}
      overlayClassName="fixed inset-0 z-50 bg-canvas/80 data-[state=open]:animate-[fade-in_150ms_var(--ease-out-soft)]"
      contentClassName="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-line-strong bg-elevated outline-none origin-top data-[state=open]:animate-[palette-in_220ms_var(--ease-out-soft)]"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Icon name="search" className="text-fg-2" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={t("shell.searchPlaceholder")}
          className="h-12 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-3"
        />
        <kbd className="num rounded border border-line px-1.5 text-[11px] text-fg-2">Esc</kbd>
      </div>
      <Command.List data-lenis-prevent className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-fg-2">{t("shell.nothingFound")}</Command.Empty>

        {actions.length > 0 && (
          <Command.Group heading={t("shell.groupActions")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-3">
            {actions.map((a) => (
              <Command.Item key={a.key} value={t(`shell.action.${a.key}`)} onSelect={a.run} className={itemClass}>
                <Icon name={a.icon} />
                {t(`shell.action.${a.key}`)}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading={t("shell.groupPages")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-3">
          {nav.map((n) => (
            <Command.Item key={n.key} value={t(`nav.${n.key}`)} onSelect={() => go(n.href)} className={itemClass}>
              <Icon name={n.icon} />
              {t(`nav.${n.key}`)}
            </Command.Item>
          ))}
        </Command.Group>

        {showResults && (
          <>
            {results.employees.length > 0 && (
              <Command.Group heading={t("nav.employees")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-3">
                {results.employees.map((e) => (
                  <Command.Item key={e.id} value={`${e.name} ${e.position} ${query}`} onSelect={() => go(`/employees?q=${encodeURIComponent(e.name)}`)} className={itemClass}>
                    <Icon name="users" />
                    <span className="text-fg">{e.name}</span>
                    <span className="truncate text-xs">{e.position}</span>
                    <span className="ml-auto text-xs">{t(`status.${e.status}`)}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {results.clients.length > 0 && (
              <Command.Group heading={t("nav.clients")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-3">
                {results.clients.map((c) => (
                  <Command.Item key={c.id} value={`${c.name} ${c.address} ${query}`} onSelect={() => go(`/clients/${c.id}`)} className={itemClass}>
                    <Icon name="building" />
                    <span className="text-fg">{c.name}</span>
                    <span className="truncate text-xs">{c.address}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            {results.requests.length > 0 && (
              <Command.Group heading={t("nav.requests")} className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-3">
                {results.requests.map((r) => (
                  <Command.Item key={r.id} value={`#${r.number} ${r.description} ${r.client} ${query}`} onSelect={() => go(`/requests/${r.id}`)} className={itemClass}>
                    <Icon name="clipboard" />
                    <span className="num text-fg">#{r.number}</span>
                    <span className="truncate">{r.description}</span>
                    <span className="ml-auto shrink-0 text-xs">{r.client}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
