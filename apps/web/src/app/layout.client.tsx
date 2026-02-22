"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getMe, logout } from "@/lib/auth";

type MeResponse = {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    lastName?: string | null;
    globalRole?: 'USER' | 'ADMIN';
    activeInstitutionId?: string | null;
    activeRole?: string | null;
    mustChangePassword?: boolean;
  };
  activeInstitution?: { id: string; name: string; plan: string } | null;
  activeInstitutionId?: string | null;
  institution?: { id: string; name: string; plan: string } | null;
  institutions?: Array<{ id: string; name: string; plan: string; role: string; status: string }> | null;
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
      <polyline points="10 9 9 9 8 9" />
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
      <path d="M12 16h.01" />
      <path d="M12 8v4" />
    </svg>
  ),
  Bell: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  Switch: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M12 21v-4" />
      <path d="M24 12l-4-4v8l4-4zM0 12l4 4V8l-4 4z" />
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
      <line x1="18.36" y1="4.22" x2="19.78" y2="5.64" />
    </svg>
  ),
  Moon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
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
            "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            "text-gray-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
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
            <div className="ml-4 mt-1 space-y-1 border-l border-gray-100 pl-4">
              {subItems.map((sub) => (
                <Link
                  key={sub.href}
                  href={sub.href}
                  onClick={onClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    "text-gray-500 hover:bg-blue-50 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-blue-400"
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
  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
          active
            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm"
            : "text-gray-600 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
        )}
      >
        <span className={cn("transition-colors", active ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-slate-500")}>
          <Icon />
        </span>
        <span className="dark:text-slate-300">{label}</span>
      </Link>
    );
  }
  return null;
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
  const queryClient = useQueryClient();

  const publicPage = useMemo(() => isPublicPath(pathname), [pathname]);

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [activeInstitutionName, setActiveInstitutionName] = useState("Sin institución");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isRefreshing = useRef(false);

  const userMenuRef = useOutsideClose<HTMLDivElement>(userMenuOpen, () => setUserMenuOpen(false));

  const userLabel = useMemo(() => {
    const name = me?.user?.name?.trim();
    const email = me?.user?.email;
    return name || email || "Cuenta";
  }, [me?.user?.name, me?.user?.email]);

  const isAdmin = me?.user?.activeRole === "admin" || me?.user?.activeRole == null;
  const isSuperAdmin = me?.user?.globalRole === "ADMIN";
  const activePlan = useMemo(() => {
    if (!me?.user?.activeInstitutionId || !me?.institutions) return "FREE";
    const active = me.institutions.find(i => i.id === me.user?.activeInstitutionId);
    return active?.plan || "FREE";
  }, [me?.user?.activeInstitutionId, me?.institutions]);

  const activeInstitutionsCount = me?.institutions?.filter((i: any) => i.status !== "inactive").length ?? 0;
  const showInstitutionButton = activeInstitutionsCount > 1 && !pathname.startsWith("/institutions");

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;

    // Si es una página pública (login/register), siempre modo día
    if (publicPage) {
      setTheme("light");
      document.documentElement.classList.remove("dark");
      return;
    }

    const isDark = savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, [publicPage]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    setMobileSidebarOpen(false);
    setUserMenuOpen(false);
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

    // Redirigir SuperAdmin a /admin si está en la raíz
    if (isSuperAdmin && pathname === "/") {
      router.replace("/admin");
      return;
    }

    if (!isAdmin && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
      router.replace("/");
    }
  }, [ready, publicPage, me, isAdmin, isSuperAdmin, pathname, router]);

  const refreshActiveInstitution = async () => {
    if (isRefreshing.current) return;
    isRefreshing.current = true;

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
        }
      } else {
        const idToUse = (fromMe.activeId || lsId).trim();
        if (idToUse) {
          const nameFromList = await resolveInstitutionNameById(idToUse);
          const finalName = (nameFromList || lsName || "Sin institución").trim();
          if (finalName !== lsName || idToUse !== lsId) {
            setActiveInstitutionName(finalName);
            safeLSSet("activeInstitutionName", finalName);
            safeLSSet("activeInstitutionId", idToUse);
          }
        }
      }
    } catch {
      if (!lsName) setActiveInstitutionName("Sin institución");
    } finally {
      isRefreshing.current = false;
    }
  };

  useEffect(() => {
    if (!ready || publicPage) return;
    refreshActiveInstitution();
  }, [ready, publicPage, pathname]);

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

  const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));



  const navItems = useMemo<any[]>(() => {
    const base = [
      { name: "Inicio", href: "/", icon: Icons.Home },
      { name: "Instituciones", href: "/institutions", icon: Icons.Institutions },
      { name: "Materias", href: "/subjects", icon: Icons.Subjects },
      { name: "Exámenes", href: "/exams", icon: Icons.Exams },
      {
        name: "Generar Exámenes",
        icon: Icons.Generate,
        subItems: [
          { name: "Generador IA", href: "/exams/builder", icon: Icons.Sparkles },
          { name: "Generador Manual", href: "/exams/manual", icon: Icons.Hammer },
        ],
      },
    ];
    if (isSuperAdmin) return [];
    return base;
  }, [isSuperAdmin]);

  const adminItems = useMemo<any[]>(() => {
    const base = [
      { name: "Equipo", href: "/users", icon: Icons.Team },
      { name: "Historial", href: "/activity-log", icon: Icons.History },
    ];
    if (isSuperAdmin) return [];
    return base;
  }, [isSuperAdmin]);

  if (!ready) return null;
  if (publicPage) return <div className="min-h-screen bg-white">{children}</div>;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-300">
      {/* Background Decorations (Full Width) */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.06] dark:opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.10) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      {/* Topbar (Centered Content) */}
      <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center border-b border-blue-500 bg-blue-600 dark:bg-slate-950 dark:border-slate-800 shadow-lg transition-colors duration-200">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 group transition-transform active:scale-95">
              <span className="text-2xl font-medium text-white font-logo">profly</span>
            </Link>
            <div className="hidden sm:flex items-center gap-2 border-l border-blue-500/50 pl-4">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-200/60">Institución</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate max-w-[200px]">{activeInstitutionName}</span>
                <span className={cn(
                  "px-1.5 py-0.5 text-[10px] font-bold rounded border",
                  activePlan === 'PREMIUM' ? "bg-amber-400 text-amber-950 border-amber-300" :
                    activePlan === 'FULL' ? "bg-emerald-400 text-emerald-950 border-emerald-300" :
                      "bg-blue-500 text-blue-100 border-blue-400"
                )}>
                  {activePlan}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1.5 border-r border-blue-500/50 pr-4 mr-2">
              <button
                onClick={toggleTheme}
                className="p-2 text-blue-100 hover:text-white transition-colors rounded-lg hover:bg-blue-500/30"
                title={theme === "light" ? "Modo Noche" : "Modo Día"}
              >
                {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
              </button>
              <button className="p-2 text-blue-100 hover:text-white transition-colors rounded-lg hover:bg-blue-500/30" title="Ayuda">
                <Icons.Help />
              </button>
              <button className="p-2 text-blue-100 hover:text-white transition-colors rounded-lg hover:bg-blue-500/30" title="Notificaciones">
                <Icons.Bell />
              </button>
              {showInstitutionButton && (
                <Link
                  href="/institutions"
                  className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-blue-400 dark:border-slate-700 bg-blue-500/30 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-500/50 dark:hover:bg-slate-700 active:scale-95"
                >
                  Cambiar Institución
                </Link>
              )}
            </div>

            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 text-white hover:text-blue-100"
            >
              <span className="text-2xl">☰</span>
            </button>
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-xs font-bold text-blue-600 shadow-md ring-2 ring-blue-400 transition-transform active:scale-95 hover:ring-white"
              >
                {userLabel[0].toUpperCase()}
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-xl ring-1 ring-black/5">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{userLabel}</p>
                    <p className="text-[10px] text-gray-500 dark:text-slate-500 truncate">{me?.user?.email}</p>
                  </div>
                  <button
                    onClick={() => { router.push("/profile"); setUserMenuOpen(false); }}
                    className="flex w-full items-center px-3 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-md"
                  >
                    Mi Perfil
                  </button>
                  <button
                    onClick={() => {
                      logout();
                      // Resetear estados locales para evitar residuo visual (stale state)
                      setMe(null);
                      setActiveInstitutionName("Sin institución");

                      // Limpiar caché de react-query para que el próximo login empiece de cero
                      queryClient.clear();

                      // El flujo de logout ya limpia localStorage y redirige
                      router.push("/login");
                    }}
                    className="flex w-full items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Area Centered (includes Sidebar) */}
      <div className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1440px]">
          {/* Desktop Sidebar */}
          <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-gray-100 dark:border-slate-800 bg-transparent py-8 md:flex">
            <nav className="flex-1 space-y-1 px-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.name}
                  href={item.href}
                  label={item.name}
                  active={item.href ? isActive(item.href) : (item.subItems?.some((s: any) => isActive(s.href)) ?? false)}
                  icon={item.icon}
                  subItems={item.subItems?.map((s: any) => ({ ...s, label: s.name }))}
                />
              ))}

              {isSuperAdmin && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                  <NavLink
                    href="/admin"
                    label="Sistema Maestro"
                    active={isActive("/admin")}
                    icon={Icons.Institutions} // O crear uno de corona/shield
                  />
                </div>
              )}

              {isAdmin && (
                <div className="my-6 border-t border-gray-100 dark:border-slate-800 pt-6">
                  <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Administración</p>
                  <div className="mt-3 space-y-1">
                    {adminItems.map((item) => (
                      <NavLink
                        key={item.name}
                        href={item.href}
                        label={item.name}
                        active={isActive(item.href)}
                        icon={item.icon}
                      />
                    ))}
                  </div>
                </div>
              )}
            </nav>
          </aside>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto px-6 pt-4 pb-12">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 shadow-2xl md:hidden">
            <div className="flex h-16 items-center border-b border-blue-500 bg-blue-600 px-6">
              <span className="text-xl font-medium text-white font-logo">profly</span>
            </div>
            <nav className="p-4 space-y-1">
              {(isAdmin ? [...navItems, ...adminItems] : navItems).map((item) => (
                <NavLink
                  key={item.name}
                  href={item.href}
                  label={item.name}
                  active={item.href ? isActive(item.href) : (item.subItems?.some((s: any) => isActive(s.href)) ?? false)}
                  icon={item.icon}
                  subItems={item.subItems?.map((s: any) => ({ ...s, label: s.name }))}
                  onClick={() => setMobileSidebarOpen(false)}
                />
              ))}
            </nav>
          </aside>
        </>
      )}
    </div>
  );
}