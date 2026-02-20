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

function Brand() {
  return (
    <Link
      href="/"
      className="whitespace-nowrap text-lg font-bold tracking-tight text-blue-600"
      style={{
        fontFamily:
          "'Montserrat Alternates','Inter','Helvetica Neue',Arial,sans-serif",
        lineHeight: "2rem",
        marginTop: "-2px",
      }}
    >
      examia
    </Link>
  );
}

function NavLink({
  href,
  label,
  active,
  onClick,
  emphasis,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-2 text-sm transition",
        emphasis
          ? "text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
        active && (emphasis ? "bg-blue-50 font-medium" : "bg-gray-100 font-medium")
      )}
    >
      {label}
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

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const publicPage = useMemo(() => isPublicPath(pathname), [pathname]);

  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [activeInstitutionName, setActiveInstitutionName] = useState("Sin institución");

  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuRef = useOutsideClose<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const mobileRef = useOutsideClose<HTMLDivElement>(mobileOpen, () =>
    setMobileOpen(false)
  );

  const userLabel = useMemo(() => {
    const name = me?.user?.name?.trim();
    const email = me?.user?.email;
    return name || email || "Cuenta";
  }, [me?.user?.name, me?.user?.email]);

  const isAdmin = me?.user?.activeRole === "admin" || me?.user?.activeRole == null;
  const institutionCount = me?.institutions?.length ?? 1;

  const allNavItems = useMemo(
    () => [
      { href: "/institutions", label: "Mis instituciones", group: "core" as const, adminOnly: false },
      { href: "/subjects", label: "Mis materias", group: "core" as const, adminOnly: false },
      { href: "/exams", label: "Mis exámenes", group: "core" as const, adminOnly: false },
      { href: "/users", label: "Profesores", group: "core" as const, adminOnly: true },
      { href: "/exams/builder", label: "Examen automático", group: "gen" as const, adminOnly: false },
      { href: "/exams/manual", label: "Examen manual", group: "gen" as const, adminOnly: false },
      { href: "/activity-log", label: "Actividad", group: "gen" as const, adminOnly: true },
    ],
    []
  );

  const navItems = useMemo(
    () => allNavItems.filter((it) => !it.adminOnly || isAdmin),
    [allNavItems, isAdmin]
  );

  const coreItems = useMemo(() => navItems.filter((x) => x.group === "core"), [navItems]);
  const genItems = useMemo(() => navItems.filter((x) => x.group === "gen"), [navItems]);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!ready) return;
    if (publicPage) return;

    if (!hasToken()) {
      const next = pathname || "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, publicPage, pathname, router]);

  // Redirigir si profesor intenta entrar a rutas solo admin
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
        setActiveInstitutionName(fromMe.activeName);
        safeLSSet("activeInstitutionName", fromMe.activeName);
        if (fromMe.activeId) safeLSSet("activeInstitutionId", fromMe.activeId);
        window.dispatchEvent(new Event("active-institution-changed"));
        return;
      }

      const idToUse = (fromMe.activeId || lsId).trim();
      if (!idToUse) {
        setActiveInstitutionName(lsName || "Sin institución");
        return;
      }

      const nameFromList = await resolveInstitutionNameById(idToUse);
      const finalName = (nameFromList || lsName || "Sin institución").trim();

      setActiveInstitutionName(finalName);
      safeLSSet("activeInstitutionName", finalName);
      safeLSSet("activeInstitutionId", idToUse);
      window.dispatchEvent(new Event("active-institution-changed"));
    } catch {
      if (!lsName) setActiveInstitutionName("Sin institución");
    }
  }

  useEffect(() => {
    if (!ready) return;
    if (publicPage) return;

    let cancelled = false;

    (async () => {
      await refreshActiveInstitution();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, publicPage]);

  useEffect(() => {
    if (!ready) return;

    function onChanged() {
      if (publicPage) return;
      refreshActiveInstitution();
    }

    function onStorage(ev: StorageEvent) {
      if (ev.key === "activeInstitutionId" || ev.key === "activeInstitutionName") {
        onChanged();
      }
      if (ev.key === "me") {
        onChanged();
      }
    }

    function onMeUpdated() {
      if (publicPage) return;

      // ✅ update instantáneo: leer cache si existe
      try {
        const raw = safeLSGet("me");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed) {
            queueMicrotask(() => setMe(parsed));
          }
        }
      } catch { }

      // ✅ y refresco real contra backend (por si cache quedó viejo)
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

  function onLogout() {
    logout();
    setMenuOpen(false);
    setMobileOpen(false);
    router.push("/login");
  }

  function goProfile() {
    setMenuOpen(false);
    setMobileOpen(false);
    router.push("/profile");
  }

  if (!ready) return null;

  const activeLabel = activeInstitutionName?.trim()
    ? activeInstitutionName
    : "Sin institución";

  const container = "mx-auto w-full max-w-6xl px-6";

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {!publicPage && (
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
          <div className={`${container} flex items-center justify-between gap-4 py-3`}>
            <div className="flex min-w-0 items-center gap-6">
              <Brand />

              {/* Desktop nav */}
              <nav className="hidden md:flex items-center gap-2">
                {coreItems.map((it) => (
                  <NavLink
                    key={it.href}
                    href={it.href}
                    label={it.label}
                    active={pathname === it.href || pathname.startsWith(it.href + "/")}
                  />
                ))}

                {/* separador sutil */}
                <span className="mx-1 h-4 w-px bg-gray-200" />

                {genItems.map((it) => (
                  <NavLink
                    key={it.href}
                    href={it.href}
                    label={it.label}
                    emphasis
                    active={pathname === it.href || pathname.startsWith(it.href + "/")}
                  />
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* Institución (desktop) */}
              {institutionCount > 1 && (
                <div className="hidden sm:flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-right leading-tight">
                    <div className="text-[11px] text-gray-500">Institución activa</div>
                    <div className="max-w-[220px] truncate text-sm font-semibold text-gray-900">
                      {activeLabel}
                    </div>
                  </div>

                  <Link
                    href="/institutions"
                    className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Cambiar
                  </Link>
                </div>
              )}
              {institutionCount <= 1 && (
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <div className="text-right leading-tight">
                    <div className="text-[11px] text-gray-500">Institución activa</div>
                    <div className="max-w-[220px] truncate text-sm font-semibold text-gray-900">
                      {activeLabel}
                    </div>
                  </div>
                </div>
              )}

              {/* Hamburguesa (mobile) */}
              <div ref={mobileRef} className="relative md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileOpen((v) => !v)}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 hover:bg-gray-50"
                  aria-expanded={mobileOpen}
                  aria-label="Abrir menú"
                >
                  {mobileOpen ? "✕" : "☰"}
                </button>

                {mobileOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-[min(92vw,320px)] rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
                    <div className="px-2 py-2">
                      <div className="text-[11px] text-gray-500">Institución activa</div>
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {activeLabel}
                      </div>

                      <Link
                        href="/institutions"
                        onClick={() => setMobileOpen(false)}
                        className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        Cambiar institución
                      </Link>
                    </div>

                    <div className="my-2 h-px bg-gray-200" />

                    <div className="grid gap-1">
                      {coreItems.map((it) => (
                        <NavLink
                          key={it.href}
                          href={it.href}
                          label={it.label}
                          active={pathname === it.href || pathname.startsWith(it.href + "/")}
                          onClick={() => setMobileOpen(false)}
                        />
                      ))}

                      <div className="my-1 h-px bg-gray-200" />

                      {genItems.map((it) => (
                        <NavLink
                          key={it.href}
                          href={it.href}
                          label={it.label}
                          emphasis
                          active={pathname === it.href || pathname.startsWith(it.href + "/")}
                          onClick={() => setMobileOpen(false)}
                        />
                      ))}
                    </div>

                    <div className="my-2 h-px bg-gray-200" />

                    <button
                      type="button"
                      onClick={goProfile}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100"
                    >
                      Perfil
                    </button>

                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* User menu (desktop/tablet) */}
              <div ref={menuRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 hover:bg-gray-50"
                >
                  <span className="max-w-[160px] truncate">{userLabel}</span>
                  <span className="text-gray-500">▾</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] min-w-[200px] rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={goProfile}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100"
                    >
                      Perfil
                    </button>

                    <div className="my-2 h-px bg-gray-200" />

                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row compacta extra (solo mobile): user label */}
          <div className="md:hidden border-t border-gray-200">
            <div className={`${container} flex items-center justify-between py-2`}>
              <div className="truncate text-sm font-medium text-gray-900">
                {userLabel}
              </div>
              <Link
                href="/profile"
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Perfil
              </Link>
            </div>
          </div>
        </header>
      )}

      <div className="mx-auto w-full max-w-6xl px-6">{children}</div>
    </div>
  );
}