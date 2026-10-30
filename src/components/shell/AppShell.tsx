"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LayoutGroup, motion, MotionConfig } from "motion/react";
import { useTranslations } from "next-intl";
import { Toaster } from "sonner";
import { Drawer } from "vaul";
import { Link, usePathname } from "@/i18n/navigation";
import { Icon, type IconName } from "../icons";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { CommandPalette } from "./CommandPalette";
import { SmoothScroll } from "./SmoothScroll";

export type NavItem = { key: string; href: string; icon: IconName };

// Пружина сайдбара из мастер-плана: жёсткость 300, затухание 30.
const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const COLLAPSE_KEY = "office-crm:sidebar-collapsed";

type Props = {
  user: { name: string; role: string };
  nav: NavItem[];
  logout: () => Promise<void>;
  children: ReactNode;
};

// Глобальный каркас: сворачиваемый сайдбар, верхняя панель с Ctrl+K, уведомления.
export function AppShell({ user, nav, logout, children }: Props) {
  const t = useTranslations();
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Свёрнутость сайдбара помним в браузере.
  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setTimeout(() => setCollapsed(true), 0);
    } catch {
      // приватный режим — просто не запоминаем
    }
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  };

  return (
    <MotionConfig reducedMotion="user">
      <SmoothScroll />
      <div className="flex min-h-screen bg-canvas">
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 64 : 232 }}
          transition={SPRING}
          className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-line bg-surface md:flex"
        >
          <div className="flex h-14 items-center gap-2 border-b border-line px-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line-strong bg-brand text-xs font-medium text-brand-ink">OC</span>
            <motion.span animate={{ opacity: collapsed ? 0 : 1 }} transition={{ duration: 0.15 }} className="truncate text-sm font-medium text-fg">
              {t("common.appName")}
            </motion.span>
          </div>
          <SidebarNav nav={nav} collapsed={collapsed} />
          <div className="mt-auto space-y-1 border-t border-line p-2">
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? t("shell.expand") : t("shell.collapse")}
              className="flex h-9 w-full items-center gap-3 rounded px-3 text-fg-2 transition-colors hover:bg-elevated hover:text-fg"
            >
              <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={SPRING} className="flex shrink-0">
                <Icon name="chevronLeft" />
              </motion.span>
              {!collapsed && <span className="truncate text-sm">{t("shell.collapse")}</span>}
            </button>
          </div>
        </motion.aside>

        <div data-vaul-drawer-wrapper className="flex min-w-0 flex-1 flex-col bg-canvas">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas px-4">
            <MobileNav nav={nav} />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded border border-line bg-surface px-3 text-sm text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2"
            >
              <Icon name="search" />
              <span className="flex-1 truncate text-left">{t("shell.searchPlaceholder")}</span>
              <kbd className="num hidden rounded border border-line px-1.5 text-[11px] text-fg-2 sm:inline">Ctrl K</kbd>
            </button>
            <div className="flex items-center gap-3 text-sm">
              <span data-testid="current-user" className="hidden text-right leading-tight lg:block">
                <span className="block text-fg">{user.name}</span>
                <span className="block text-xs text-fg-2">{t(`roles.${user.role}`)}</span>
              </span>
              <LanguageSwitcher />
              <form action={logout}>
                <button type="submit" aria-label={t("common.logout")} title={t("common.logout")} className="flex h-9 w-9 items-center justify-center rounded border border-line text-fg-2 transition-colors hover:border-line-strong hover:text-fg">
                  <Icon name="logout" />
                </button>
              </form>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6">{children}</main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} nav={nav} />
      <Toaster
        theme="dark"
        position="bottom-right"
        visibleToasts={4}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: "flex w-[22rem] items-start gap-3 rounded-md border border-line-strong bg-elevated px-4 py-3 text-sm text-fg",
            title: "font-medium",
            description: "text-fg-2",
            success: "[&_[data-icon]]:text-success",
            error: "[&_[data-icon]]:text-danger",
          },
        }}
      />
    </MotionConfig>
  );
}

// Пункты меню: тёмная плашка наведения «скользит» за курсором (layoutId), активный пункт отмечен полосой бренда.
function SidebarNav({ nav, collapsed }: { nav: NavItem[]; collapsed: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [hovered, setHovered] = useState<string | null>(null);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <LayoutGroup id="sidebar">
      <nav className="flex-1 overflow-y-auto p-2" onMouseLeave={() => setHovered(null)}>
        <ul className="space-y-0.5">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.key} onMouseEnter={() => setHovered(item.key)}>
                <Link
                  href={item.href}
                  title={collapsed ? t(item.key) : undefined}
                  aria-current={active ? "page" : undefined}
                  onFocus={() => setHovered(item.key)}
                  className={`relative flex h-9 items-center gap-3 rounded px-3 text-sm transition-colors duration-150 ${active ? "text-fg" : "text-fg-2 hover:text-fg"}`}
                >
                  {hovered === item.key && (
                    <motion.span layoutId="hover-indicator" className="absolute inset-0 rounded bg-elevated" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                  )}
                  {active && <motion.span layoutId="active-indicator" className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-brand-fg" transition={SPRING} />}
                  <Icon name={item.icon} className="relative shrink-0" />
                  {!collapsed && <span className="relative truncate">{t(item.key)}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </LayoutGroup>
  );
}

// На телефоне меню выезжает слева (Vaul), фон приложения слегка уменьшается.
function MobileNav({ nav }: { nav: NavItem[] }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    const id = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(id);
  }, [pathname]);
  if (nav.length === 0) return null;

  return (
    <Drawer.Root direction="left" open={open} onOpenChange={setOpen} shouldScaleBackground>
      <Drawer.Trigger aria-label={t("shell.menu")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line text-fg-2 md:hidden">
        <Icon name="menu" />
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-canvas/80" />
        <Drawer.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-surface outline-none">
          <Drawer.Title className="flex h-14 items-center border-b border-line px-4 text-sm font-medium text-fg">{t("common.appName")}</Drawer.Title>
          <nav className="p-2">
            {nav.map((item) => (
              <Link key={item.key} href={item.href} className="flex h-10 items-center gap-3 rounded px-3 text-sm text-fg-2 hover:bg-elevated hover:text-fg">
                <Icon name={item.icon} />
                {t(`nav.${item.key}`)}
              </Link>
            ))}
          </nav>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
