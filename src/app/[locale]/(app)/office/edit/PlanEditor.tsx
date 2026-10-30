"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ZoneType } from "@prisma/client";
import { PlanCanvas, pct, zoneColor, type PlanDesk, type PlanImage, type PlanZone } from "@/components/office/PlanCanvas";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/ui";
import { MAX_PLAN_BYTES, rectFromPoints } from "@/lib/office-plan";
import { ZONE_TYPES } from "@/lib/validation";
import { deleteDesk, deleteZone, restoreTestPlan, saveDesk, saveZone, type ActionResult } from "../actions";

type Mode = "select" | "desk" | "zone";
type Pt = { x: number; y: number };
type DeskDraft = { id?: string; code: string; pcNumber: string; x: number; y: number; employeeId: string };
type ZoneDraft = { id?: string; name: string; type: ZoneType; x: number; y: number; width: number; height: number };
type Panel = { kind: "desk"; draft: DeskDraft } | { kind: "zone"; draft: ZoneDraft } | null;

type Props = {
  plan: PlanImage;
  zones: PlanZone[];
  desks: PlanDesk[];
  employees: { id: string; label: string; deskCode: string | null }[];
};

// Следующий свободный номер места: 01, 02, …
function nextCode(desks: PlanDesk[]) {
  const used = new Set(desks.map((d) => d.code));
  for (let i = 1; ; i++) {
    const code = String(i).padStart(2, "0");
    if (!used.has(code)) return code;
  }
}

export function PlanEditor({ plan, zones, desks, employees }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("desk");
  const [panel, setPanel] = useState<Panel>(null);
  const [dragStart, setDragStart] = useState<Pt | null>(null);
  const [dragNow, setDragNow] = useState<Pt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Удаление в два нажатия: «Удалить» → «Точно удалить?». Сбрасывается при смене карточки.
  const [armed, setArmed] = useState(false);
  const [armedFor, setArmedFor] = useState<string | null>(null);
  const currentId = panel?.draft.id ?? null;
  if (armedFor !== currentId) {
    setArmedFor(currentId);
    setArmed(false);
  }

  const run = (action: () => Promise<ActionResult>, close = true) =>
    startTransition(async () => {
      setError(null);
      const res = await action();
      if (res.error) return setError(res.error);
      if (close) setPanel(null);
      router.refresh();
    });

  const switchMode = (m: Mode) => {
    setMode(m);
    setPanel(null);
    setError(null);
  };

  // Клик по плану: в режиме «место» ставит новое место (или переносит открытое),
  // в режиме «зона» начинает рисовать прямоугольник.
  const onDown = (p: Pt) => {
    if (panel?.kind === "desk") return setPanel({ kind: "desk", draft: { ...panel.draft, ...p } });
    if (mode === "desk") {
      const code = nextCode(desks);
      setError(null);
      setPanel({ kind: "desk", draft: { code, pcNumber: `PC-${code}`, employeeId: "", ...p } });
    } else if (mode === "zone") {
      setPanel(null);
      setDragStart(p);
      setDragNow(p);
    } else {
      setPanel(null);
    }
  };
  const onUp = (p: Pt) => {
    if (!dragStart) return;
    const rect = rectFromPoints(dragStart, p);
    setDragStart(null);
    setDragNow(null);
    // Случайный клик без протягивания зону не создаёт.
    if (rect.width < 0.02 || rect.height < 0.02) return;
    setError(null);
    setPanel({ kind: "zone", draft: { name: "", type: "MEETING", ...rect } });
  };

  const draftRect = dragStart && dragNow ? rectFromPoints(dragStart, dragNow) : null;
  const selectedId = panel?.draft.id ?? null;
  const pendingDesk = panel?.kind === "desk" ? panel.draft : null;

  const upload = (file: File) => {
    if (file.size > MAX_PLAN_BYTES) return setError("imageTooBig");
    const body = new FormData();
    body.set("file", file);
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/office-plan/image", { method: "POST", body });
      if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "invalid");
      router.refresh();
    });
  };

  const modeButton = (m: Mode) => (
    <button
      key={m}
      type="button"
      onClick={() => switchMode(m)}
      aria-pressed={mode === m}
      className={`rounded-md px-3 py-1.5 text-sm ${mode === m ? "bg-pressed text-brand-ink" : "bg-surface text-fg hover:bg-pressed"}`}
    >
      {t(`office.mode.${m}`)}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["desk", "zone", "select"] as const).map(modeButton)}
        <span className="text-sm text-fg-2">{t(`office.hint.${mode}`)}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <label className={`${secondaryButtonClass} cursor-pointer`}>
            {t("office.upload")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" className={secondaryButtonClass} disabled={pending} onClick={() => run(restoreTestPlan, false)}>
            {t("office.testPlan")}
          </button>
        </div>
      </div>
      <p className="text-xs text-fg-2">{t("office.uploadHint")}</p>
      {error && !panel && <p className="text-sm text-danger">{t(`errors.${error}`)}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <PlanCanvas
          plan={plan}
          zones={zones}
          desks={desks.map((d) => (pendingDesk?.id === d.id ? { ...d, x: pendingDesk.x, y: pendingDesk.y } : d))}
          selectedId={selectedId}
          zonesClickable={mode === "select"}
          onPlanPointerDown={onDown}
          onPlanPointerMove={(p) => dragStart && setDragNow(p)}
          onPlanPointerUp={onUp}
          onDeskClick={(d) => {
            setError(null);
            setPanel({
              kind: "desk",
              draft: { id: d.id, code: d.code, pcNumber: d.pcNumber ?? "", x: d.x, y: d.y, employeeId: d.employee?.id ?? "" },
            });
          }}
          onZoneClick={(z) => {
            setError(null);
            setPanel({ kind: "zone", draft: { ...z } });
          }}
        >
          {draftRect && (
            <div
              className="pointer-events-none absolute border border-dashed border-brand-fg bg-brand/20"
              style={{ left: pct(draftRect.x), top: pct(draftRect.y), width: pct(draftRect.width), height: pct(draftRect.height) }}
            />
          )}
          {pendingDesk && !pendingDesk.id && (
            <div
              className="pointer-events-none absolute flex h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center num rounded-full border border-brand-fg bg-brand px-1 text-xs text-brand-ink ring-2 ring-brand-fg/40"
              style={{ left: pct(pendingDesk.x), top: pct(pendingDesk.y) }}
            >
              {pendingDesk.code || "?"}
            </div>
          )}
          {panel?.kind === "zone" && !panel.draft.id && (
            <div
              className={`pointer-events-none absolute border-2 ${zoneColor[panel.draft.type]}`}
              style={{ left: pct(panel.draft.x), top: pct(panel.draft.y), width: pct(panel.draft.width), height: pct(panel.draft.height) }}
            />
          )}
        </PlanCanvas>

        <aside className="space-y-3 rounded-lg border border-line bg-surface p-4 lg:self-start">
          {!panel && <p className="text-sm text-fg-2">{t("office.panelEmpty")}</p>}

          {panel?.kind === "desk" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => saveDesk(panel.draft));
              }}
            >
              <h2 className="font-medium">{panel.draft.id ? t("office.editDesk") : t("office.newDesk")}</h2>
              <label className="block">
                <span className="text-sm text-fg-2">{t("office.deskCode")}</span>
                <input
                  value={panel.draft.code}
                  onChange={(e) => setPanel({ kind: "desk", draft: { ...panel.draft, code: e.target.value } })}
                  className={inputClass}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-sm text-fg-2">{t("office.pcNumber")}</span>
                <input
                  value={panel.draft.pcNumber}
                  placeholder="PC-07"
                  onChange={(e) => setPanel({ kind: "desk", draft: { ...panel.draft, pcNumber: e.target.value } })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="text-sm text-fg-2">{t("office.employee")}</span>
                <select
                  value={panel.draft.employeeId}
                  onChange={(e) => setPanel({ kind: "desk", draft: { ...panel.draft, employeeId: e.target.value } })}
                  className={inputClass}
                >
                  <option value="">{t("office.free")}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.label}
                      {emp.deskCode && emp.deskCode !== panel.draft.code ? ` (${t("office.desk")} ${emp.deskCode})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-fg-2">{t("office.moveHint")}</p>
              {error && <p className="text-sm text-danger">{t(`errors.${error}`)}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={buttonClass}>
                  {t("common.save")}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setPanel(null)}>
                  {t("common.cancel")}
                </button>
                {panel.draft.id && (
                  <button
                    type="button"
                    disabled={pending}
                    className="ml-auto text-sm text-danger hover:underline"
                    onClick={() => (armed ? run(() => deleteDesk(panel.draft.id!)) : setArmed(true))}
                  >
                    {armed ? t("office.confirmDelete") : t("common.delete")}
                  </button>
                )}
              </div>
            </form>
          )}

          {panel?.kind === "zone" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => saveZone(panel.draft));
              }}
            >
              <h2 className="font-medium">{panel.draft.id ? t("office.editZone") : t("office.newZone")}</h2>
              <label className="block">
                <span className="text-sm text-fg-2">{t("office.zoneName")}</span>
                <input
                  value={panel.draft.name}
                  placeholder={t("office.zoneNamePlaceholder")}
                  onChange={(e) => setPanel({ kind: "zone", draft: { ...panel.draft, name: e.target.value } })}
                  className={inputClass}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-sm text-fg-2">{t("office.zoneType")}</span>
                <select
                  value={panel.draft.type}
                  onChange={(e) => setPanel({ kind: "zone", draft: { ...panel.draft, type: e.target.value as ZoneType } })}
                  className={inputClass}
                >
                  {ZONE_TYPES.map((z) => (
                    <option key={z} value={z}>
                      {t(`zoneType.${z}`)}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p className="text-sm text-danger">{t(`errors.${error}`)}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={pending} className={buttonClass}>
                  {t("common.save")}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setPanel(null)}>
                  {t("common.cancel")}
                </button>
                {panel.draft.id && (
                  <button
                    type="button"
                    disabled={pending}
                    className="ml-auto text-sm text-danger hover:underline"
                    onClick={() => (armed ? run(() => deleteZone(panel.draft.id!)) : setArmed(true))}
                  >
                    {armed ? t("office.confirmDelete") : t("common.delete")}
                  </button>
                )}
              </div>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
