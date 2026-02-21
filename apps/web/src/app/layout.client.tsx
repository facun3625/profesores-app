"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getMe, logout } from "@/lib/auth";

type MeResponse = {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    activeInstitutionId?: string | null;
    activeRole?: string | null;
    mustChangePassword?: boolean;
  };
  activeInstitution?: { id: string; name: string } | null;
  activeInstitutionId?: string | null;
  institution?: { id: string; name: string } | null;
  institutions?: Array<{ id: string; name: string; role: string }> | null;
};

// --- Helpers ---
function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function hasToken() {
  try {
    const ls = localStorage.getItem("accessToken");
    const ck = getCookie("accessToken");
    return Boolean((ls && ls.length) || (ck && ck.length));
  } catch {
    return false;
  }
}

function safeLSGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLSSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch { }
}

function isPublicPath(pathname: string) {
  return pathname.startsWith("/login") || pathname.startsWith("/register");
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// --- Icons ---
const Icons = {
  Home: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Institutions: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  Subjects: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  Exams: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  Team: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  History: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Generate: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 14" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Sparkles: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 3l1.912 5.813L21 10.75l-5.813 1.912L12 21l-1.912-5.813L3 13.25l5.813-1.912L12 3z" />
    </svg>
  ),
  Hammer: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  Help: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Sun: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
};

// --- Components ---
function NavLink({
  href,
  label,
  active,
  icon: Icon,
  onClick,
  subItems,
}: {
  href?: string;
  label: string;
  active: boolean;
  icon: React.ComponentType;
  onClick?: () => void;
  subItems?: Array<{ href: string; label: string; icon: React.ComponentType }>;
}) {
  const [open, setOpen] = useState(false);

  if (subItems) {
    return (
      <div className="space-y-1">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "sidebar-item flex w-full items-center justify-between rounded px-3 py-1.5 transition-colors",
            "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon />
            <span>{label}</span>
          </div>
          <div className={cn("transition-transform", open && "rotate-180")}>
            <Icons.ChevronDown />
          </div>
        </button>
        <div className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="overflow-hidden">
            <div className="ml-4 space-y-1 border-l border-gray-100/10 pl-4">
              {subItems.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={onClick}
                  className={cn(
                    "sidebar-item flex items-center gap-3 rounded px-3 py-1.5 transition-colors text-sm",
                    "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                  )}
                >
                  <sub.icon />
                  <span>{sub.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={href!}
      onClick={onClick}
      className={cn(
        "sidebar-item flex items-center gap-3 rounded px-3 py-1.5 transition-colors",
        active
          ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-medium"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
      )}
    >
      <Icon />
      <span>{label}</span>
    </Link>
  );
}

function useOutsideClose<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    function onDocDown(ev: MouseEvent) {
      if (!open) return;
      const el = ref.current;
      if (!el) return;
      if (el.contains(ev.target as Node)) return;
      onClose();
    }

    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return ref;
}

function pickActiveFromMe(meRes: any) {
  const activeId =
    meRes?.activeInstitutionId ??
    meRes?.user?.activeInstitutionId ??
    meRes?.activeInstitution?.id ??
    meRes?.institution?.id ??
    null;

  const activeName =
    meRes?.activeInstitution?.name ?? meRes?.institution?.name ?? "";

  return {
    activeId: activeId ? String(activeId) : "",
    activeName: activeName ? String(activeName).trim() : "",
  };
}

async function resolveInstitutionNameById(id: string) {
  const list: any[] = await api<any[]>("/institutions");
  const found = list?.find((i) => String(i?.id) === String(id));
  return (found?.name?.trim?.() as string) || "";
}

// --- Main Layout ---
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const publicPage = useMemo(() => isPublicPath(pathname), [pathname]);

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activeInstitutionName, setActiveInstitutionName] = useState("Sin institución");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const userMenuRef = useOutsideClose<HTMLDivElement>(userMenuOpen, () => setUserMenuOpen(false));
  const helpMenuRef = useOutsideClose<HTMLDivElement>(helpMenuOpen, () => setHelpMenuOpen(false));

  const userLabel = useMemo(() => {
    const name = me?.user?.name?.trim();
    const email = me?.user?.email;
    return name || email || "Cuenta";
  }, [me?.user?.name, me?.user?.email]);

  const isAdmin = me?.user?.activeRole === "admin" || me?.user?.activeRole == null;
  const institutionCount = me?.institutions?.length ?? 1;

  useEffect(() => {
    setReady(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initialTheme = savedTheme || systemTheme;
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  useEffect(() => {
    setMobileSidebarOpen(false);
    setUserMenuOpen(false);
    setHelpMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    if (publicPage) return;

    if (!hasToken()) {
      const next = pathname || "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, publicPage, pathname, router]);

  const ADMIN_ROUTES = ["/users", "/activity-log"];
  useEffect(() => {
    if (!ready || publicPage || !me) return;
    if (!isAdmin && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
      router.replace("/");
    }
  }, [ready, publicPage, me, isAdmin, pathname, router]);

  async function refreshActiveInstitution() {
    const lsName = (safeLSGet("activeInstitutionName") || "").trim();
    const lsId = (safeLSGet("activeInstitutionId") || "").trim();
    if (lsName) setActiveInstitutionName(lsName);

    try {
      const meRes: any = await getMe();
      setMe(meRes);
      const fromMe = pickActiveFromMe(meRes);

      if (fromMe.activeName) {
        if (fromMe.activeName !== lsName || fromMe.activeId !== lsId) {
          setActiveInstitutionName(fromMe.activeName);
          safeLSSet("activeInstitutionName", fromMe.activeName);
          if (fromMe.activeId) safeLSSet("activeInstitutionId", fromMe.activeId);
          window.dispatchEvent(new Event("active-institution-changed"));
        }
        return;
      }

      const idToUse = (fromMe.activeId || lsId).trim();
      if (!idToUse) {
        setActiveInstitutionName(lsName || "Sin institución");
        return;
      }

      const nameFromList = await resolveInstitutionNameById(idToUse);
      const finalName = (nameFromList || lsName || "Sin institución").trim();

      if (finalName !== lsName || idToUse !== lsId) {
        setActiveInstitutionName(finalName);
        safeLSSet("activeInstitutionName", finalName);
        safeLSSet("activeInstitutionId", idToUse);
        window.dispatchEvent(new Event("active-institution-changed"));
      }
    } catch {
      if (!lsName) setActiveInstitutionName("Sin institución");
    }
  }

  useEffect(() => {
    if (!ready || publicPage) return;
    refreshActiveInstitution();
  }, [ready, publicPage]);

  useEffect(() => {
    if (!ready) return;
    function onChanged() { if (!publicPage) refreshActiveInstitution(); }
    function onStorage(ev: StorageEvent) {
      if (ev.key === "activeInstitutionId" || ev.key === "activeInstitutionName" || ev.key === "me") onChanged();
    }
    function onMeUpdated() {
      if (publicPage) return;
      try {
        const raw = safeLSGet("me");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed) queueMicrotask(() => setMe(parsed));
        }
      } catch { }
      onChanged();
    }
    window.addEventListener("active-institution-changed", onChanged as any);
    window.addEventListener("me:updated", onMeUpdated as any);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("active-institution-changed", onChanged as any);
      window.removeEventListener("me:updated", onMeUpdated as any);
      window.removeEventListener("storage", onStorage);
    };
  }, [ready, publicPage]);

  if (!ready) return null;

  const Sidebar = () => (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 bg-sidebar-bg transition-transform duration-300 md:relative md:translate-x-0 dark:border-white/5",
      !mobileSidebarOpen && "-translate-x-full"
    )}>
      {/* Sidebar Header */}
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="md:hidden flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-blue-500" style={{ fontFamily: "'Montserrat Alternates', sans-serif" }}>
            profly
          </span>
        </Link>
      </div>

      {/* Nav Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        <div className="space-y-0.5">
          <NavLink href="/" label="Home" active={pathname === "/"} icon={Icons.Home} />
          <NavLink href="/institutions" label="Instituciones" active={pathname === "/institutions"} icon={Icons.Institutions} />
          <NavLink href="/subjects" label="Materias" active={pathname === "/subjects" || pathname.startsWith("/subjects/")} icon={Icons.Subjects} />
          <NavLink href="/exams" label="Exámenes" active={pathname === "/exams"} icon={Icons.Exams} />
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-0.5">
          <NavLink
            label="Generar Exámenes"
            active={pathname.startsWith("/exams/builder") || pathname.startsWith("/exams/manual")}
            icon={Icons.Generate}
            subItems={[
              { href: "/exams/builder", label: "Generador IA", icon: Icons.Sparkles },
              { href: "/exams/manual", label: "Generador Manual", icon: Icons.Hammer },
            ]}
          />
        </div>

        {isAdmin && (
          <div className="pt-4 border-t border-gray-100 dark:border-white/5 space-y-0.5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Settings and administration</p>
            <NavLink href="/users" label="Equipo" active={pathname === "/users"} icon={Icons.Team} />
            <NavLink href="/activity-log" label="Historial" active={pathname === "/activity-log"} icon={Icons.History} />
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-white/5">
        <div className="rounded border border-gray-100 dark:border-white/5 p-3">
          <p className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500">Plan</p>
          <p className="sidebar-item font-medium text-gray-700 dark:text-gray-300">Profly Institutional</p>
        </div>
      </div>
    </aside>
  );

  if (publicPage) return <div className="min-h-screen bg-background">{children}</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between bg-navbar-bg px-6 shadow-sm">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 text-white hover:bg-white/10 rounded"
            >
              ☰
            </button>
            <Link href="/" className="hidden md:flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "'Montserrat Alternates', sans-serif" }}>
                profly
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Help Dropdown */}
            <div ref={helpMenuRef} className="relative">
              <button
                onClick={() => setHelpMenuOpen(!helpMenuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
                title="Ayuda"
              >
                <Icons.Help />
              </button>
              {helpMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md border border-gray-200 bg-white p-1 shadow-xl ring-1 ring-black/5 dark:bg-[#2d3338] dark:border-white/10">
                  <Link href="/docs" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded dark:text-gray-200 dark:hover:bg-white/5">Documentation</Link>
                  <Link href="/forums" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded dark:text-gray-200 dark:hover:bg-white/5">Forums</Link>
                  <Link href="/support" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded dark:text-gray-200 dark:hover:bg-white/5">Contact support</Link>
                  <Link href="/status" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded dark:text-gray-200 dark:hover:bg-white/5">System status</Link>
                </div>
              )}
            </div>

            {/* Notifications */}
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors" title="Notificaciones">
              <Icons.Bell />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/10 transition-colors"
              title={theme === "light" ? "Modo oscuro" : "Modo claro"}
            >
              {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
            </button>

            {/* User Profile */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white border border-white/30 transition-transform active:scale-95"
              >
                {userLabel[0].toUpperCase()}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-md border border-gray-200 bg-white p-1 shadow-xl ring-1 ring-black/5 dark:bg-[#2d3338] dark:border-white/10">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{me?.user?.activeRole || 'User'}</p>
                    <p className="text-sm font-bold text-gray-900 truncate dark:text-white mt-1">{userLabel}</p>
                    <p className="text-xs text-gray-500 truncate dark:text-gray-400">{me?.user?.email}</p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { router.push("/profile"); setUserMenuOpen(false); }}
                      className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
                    >
                      Settings
                    </button>
                    <button
                      onClick={() => { logout(); router.push("/login"); }}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Backdrop for mobile sidebar */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="relative flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-6xl">
            {/* Breadcrumb-like title */}
            {!pathname.includes('builder') && (
              <div className="mb-8">
                <h1 className="title-premium text-foreground flex items-center gap-2">
                  <span className="text-gray-400">/</span> {activeInstitutionName}
                </h1>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}