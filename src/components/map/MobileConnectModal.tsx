"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { generateQrSvg } from "@/lib/qr";

export function MobileConnectModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const t = useTranslations("map");
  const [url, setUrl] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== "undefined") {
        setUrl(`${window.location.origin}/ru/login`);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!isOpen) return null;

  const qrSvg = url ? generateQrSvg(url, 180) : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md space-y-4 rounded-lg border border-line-strong bg-surface p-6">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 className="text-base font-medium text-fg">{t("connectPhoneTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-fg-2 hover:bg-elevated hover:text-fg"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-fg-2">{t("connectPhoneDesc")}</p>

        {url && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-line bg-canvas p-4 text-center">
            <div
              className="rounded bg-surface p-2 text-fg"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <code className="num rounded bg-elevated px-2 py-1 text-xs text-brand-fg">{url}</code>
          </div>
        )}

        <div className="space-y-1.5 rounded-lg border border-line bg-elevated p-3 text-xs">
          <p className="font-medium text-fg">{t("loginAs")}</p>
          <p className="num text-fg-2">{t("courierLogin")}</p>
          <p className="num text-fg-2">{t("courierPassword")}</p>
        </div>

        <p className="text-xs text-fg-3">{t("httpsNote")}</p>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-line-strong bg-elevated px-4 py-2 text-sm text-fg transition-colors hover:bg-pressed"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
