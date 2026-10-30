// Общие классы дизайн-системы «Strict Dark». Только токены из globals.css:
// глубина — ступенями фона и рамками 1px, без теней; радиусы 4px у полей и тегов, 6–8px у контейнеров.

export const inputClass =
  "mt-1 block w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-fg placeholder:text-fg-3 transition-colors duration-150 ease-out-soft hover:border-line-strong focus:border-line-strong focus:bg-surface focus:outline-none";

export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded border border-brand bg-brand px-4 py-2 text-sm font-medium text-brand-ink transition-colors duration-150 ease-out-soft hover:bg-brand-hover disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded border border-line bg-surface px-4 py-2 text-sm text-fg transition-colors duration-150 ease-out-soft hover:border-line-strong hover:bg-elevated disabled:opacity-50";

export const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded border border-danger-bg bg-danger-bg px-4 py-2 text-sm font-medium text-danger transition-colors duration-150 ease-out-soft hover:border-danger/40 disabled:opacity-50";

export const linkClass = "text-brand-fg underline-offset-2 transition-colors hover:underline";

export const cardClass = "rounded-lg border border-line bg-surface";

export const labelClass = "text-sm text-fg-2";
export const errorTextClass = "mt-1 text-xs text-danger";
export const pageTitleClass = "text-xl font-medium text-fg";
export const sectionTitleClass = "text-sm font-medium text-fg";

export const badgeClass = "inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-xs";

// Таблицы: рамки 1px между строками, подсветка строки фоном.
export const table = {
  wrap: "overflow-x-auto rounded-lg border border-line bg-surface",
  table: "w-full text-left text-sm",
  head: "border-b border-line text-xs uppercase tracking-wide text-fg-2",
  th: "px-4 py-2.5 font-medium",
  row: "border-b border-line transition-colors duration-150 last:border-0 hover:bg-elevated",
  td: "px-4 py-2.5",
};

export const statusColor = {
  IN_OFFICE: "bg-success-bg text-success",
  OUT_OF_OFFICE: "bg-warning-bg text-warning",
  OFF_WORK: "bg-pressed text-fg-2",
} as const;

export const requestStatusColor = {
  NEW: "bg-info-bg text-info",
  ASSIGNED: "bg-pressed text-fg",
  IN_PROGRESS: "bg-warning-bg text-warning",
  DONE: "bg-success-bg text-success",
} as const;
