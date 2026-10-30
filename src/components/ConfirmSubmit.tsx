"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

type Props = {
  message?: string; // если задано — сначала спросить «Точно?»
  toastMessage?: string; // уведомление после нажатия
  className?: string;
  name?: string;
  value?: string;
  children: ReactNode;
};

// Кнопка отправки формы. Подтверждение не системным окном, а маленьким окном,
// которое «вырастает» из самой кнопки; Esc — отмена. Защита от двойного клика.
export function ConfirmSubmit({ message, toastMessage, className, name, value, children }: Props) {
  const t = useTranslations("shell");
  const { pending } = useFormStatus();
  const [asking, setAsking] = useState(false);
  const yesRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!asking) return;
    yesRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAsking(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking]);

  const notify = () => toastMessage && toast.success(toastMessage);

  if (!message) {
    return (
      <button type="submit" name={name} value={value} disabled={pending} className={className} onClick={notify}>
        {children}
      </button>
    );
  }

  return (
    <span className="relative inline-flex">
      <button type="button" disabled={pending} className={className} aria-expanded={asking} onClick={() => setAsking((a) => !a)}>
        {children}
      </button>
      <AnimatePresence>
        {asking && (
          <motion.span
            role="dialog"
            aria-label={message}
            initial={{ opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 2 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            style={{ transformOrigin: "bottom left" }}
            className="absolute bottom-full left-0 z-40 mb-2 w-72 rounded-md border border-line-strong bg-elevated p-3 text-sm text-fg"
          >
            <span className="block">{message}</span>
            <span className="mt-3 flex gap-2">
              <button
                ref={yesRef}
                type="submit"
                name={name}
                value={value}
                onClick={() => {
                  notify();
                  setAsking(false);
                }}
                className="rounded border border-brand bg-brand px-3 py-1.5 text-sm font-medium text-brand-ink hover:bg-brand-hover"
              >
                {t("confirmYes")}
              </button>
              <button type="button" onClick={() => setAsking(false)} className="rounded border border-line px-3 py-1.5 text-sm text-fg-2 hover:border-line-strong hover:text-fg">
                {t("confirmNo")}
              </button>
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
