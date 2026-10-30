"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string; // текущее значение («сырое»)
  display?: ReactNode; // как показать, если не совпадает с value
  kind?: "text" | "textarea" | "date" | "select";
  options?: Option[];
  editable: boolean;
  mono?: boolean;
  onSave: (value: string) => Promise<{ ok: boolean; error?: string }>;
};

// Поле с правкой «на лету»: клик или Enter — редактировать, Enter (Ctrl+Enter в тексте) — сохранить, Esc — отмена.
export function InlineField({ label, value, display, kind = "text", options, editable, mono, onSave }: Props) {
  const t = useTranslations("entity");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const start = () => {
    if (!editable) return;
    setDraft(value);
    setEditing(true);
  };
  const save = async (next = draft) => {
    if (next === value) return setEditing(false);
    setSaving(true);
    const res = await onSave(next);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      toast.success(t("saved", { field: label }));
    } else toast.error(t(`errors.${res.error ?? "invalid"}`));
  };

  const shared = {
    ref: inputRef,
    disabled: saving,
    className: `w-full rounded border border-line-strong bg-canvas px-2 py-1.5 text-sm text-fg focus:outline-none ${mono ? "num" : ""}`,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setEditing(false);
      }
      if (e.key === "Enter" && (kind !== "textarea" || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void save();
      }
    },
  };

  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-start gap-3 border-b border-line py-2.5 last:border-0">
      <span className="pt-1.5 text-xs uppercase tracking-wide text-fg-2">{label}</span>
      {editing ? (
        <div className="space-y-1">
          {kind === "textarea" ? (
            <textarea {...shared} rows={4} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => save()} />
          ) : kind === "select" ? (
            <select
              {...shared}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                void save(e.target.value);
              }}
              onBlur={() => setEditing(false)}
            >
              {options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input {...shared} type={kind === "date" ? "date" : "text"} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => save()} />
          )}
          <span className="block text-[11px] text-fg-3">{kind === "textarea" ? t("hintTextarea") : t("hintInput")}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={!editable}
          className={`min-h-8 rounded px-2 py-1.5 text-left text-sm text-fg transition-colors duration-150 ${editable ? "hover:bg-pressed" : "cursor-default"} ${mono ? "num" : ""}`}
        >
          {display ?? (value || <span className="text-fg-3">—</span>)}
        </button>
      )}
    </div>
  );
}
