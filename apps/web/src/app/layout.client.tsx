"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getMe, logout } from "@/lib/auth";

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

type MeResponse = {
  user?: { id: string; email: string; name?: string | null; activeInstitutionId?: string | null };
  activeInstitution?: { id: string; name: string } | null;
  activeInstitutionId?: string | null;
  institution?: { id: string; name: string } | null;
};

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
  } catch {}
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);

  const isPublic = useMemo(() => {
    return pathname.startsWith("/login") || pathname.startsWith("/register");
  }, [pathname]);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [activeInstitutionName, setActiveInstitutionName] = useState("Sin institución");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (isPublic) return;

    const ok = hasToken();
    if (!ok) {
      const next = pathname || "/";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [ready, isPublic, pathname, router]);

  async function refreshActiveInstitution() {
    const lsName = (safeLSGet("activeInstitutionName") || "").trim();
    const lsId = (safeLSGet("activeInstitutionId") || "").trim();

    if (lsName) setActiveInstitutionName(lsName);

    try {
      const meRes: any = await getMe();
      setMe(meRes);

      const activeId =
        meRes?.activeInstitutionId ??
        meRes?.user?.activeInstitutionId ??
        meRes?.activeInstitution?.id ??
        meRes?.institution?.id ??
        null;

      const activeNameFromMe =
        meRes?.activeInstitution?.name ??
        meRes?.institution?.name ??
        "";

      if (activeNameFromMe && String(activeNameFromMe).trim()) {
        const n = String(activeNameFromMe).trim();
        setActiveInstitutionName(n);
        safeLSSet("activeInstitutionName", n);
        if (activeId) safeLSSet("activeInstitutionId", String(activeId));
        return;
      }

      const idToUse = String(activeId || lsId || "").trim();
      if (!idToUse) {
        setActiveInstitutionName(lsName || "Sin institución");
        return;
      }

      const list: any[] = await api<any[]>("/institutions");
      const found = list?.find((i) => i?.id === idToUse);
      const finalName = found?.name?.trim?.() || lsName || "Sin institución";

      setActiveInstitutionName(finalName);
      safeLSSet("activeInstitutionName", finalName);
      safeLSSet("activeInstitutionId", idToUse);
    } catch {
      if (!lsName) setActiveInstitutionName("Sin institución");
    }
  }

  useEffect(() => {
    if (!ready) return;
    if (isPublic) return;

    let cancelled = false;

    (async () => {
      await refreshActiveInstitution();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, isPublic]);

  useEffect(() => {
    if (!ready) return;

    function onChanged() {
      if (isPublic) return;
      refreshActiveInstitution();
    }

    function onStorage(ev: StorageEvent) {
      if (ev.key === "activeInstitutionId" || ev.key === "activeInstitutionName") {
        onChanged();
      }
    }

    window.addEventListener("active-institution-changed", onChanged);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("active-institution-changed", onChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [ready, isPublic]);

  useEffect(() => {
    function onDocDown(ev: MouseEvent) {
      if (!menuOpen) return;
      const el = menuRef.current;
      if (!el) return;
      if (el.contains(ev.target as Node)) return;
      setMenuOpen(false);
    }

    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function onLogout() {
    logout();
    setMenuOpen(false);
    router.push("/login");
  }

  function goProfile() {
    setMenuOpen(false);
    router.push("/profile");
  }

  const userLabel = me?.user?.name?.trim() || me?.user?.email || "Cuenta";

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh" }}>
      {!isPublic && (
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            borderBottom: "1px solid #e5e5e5",
            background: "white",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <a
                href="/"
                style={{ fontWeight: 700, textDecoration: "none", color: "inherit" }}
              >
                Profesores App
              </a>

              <nav style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="/institutions">Instituciones</a>
                <a href="/subjects">Materias</a>
                <a href="/exams">Exámenes</a>
                <a href="/exams/builder">Examen automático</a>
                <a href="/exams/manual">Examen manual</a>
              </nav>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "right", lineHeight: 1.1 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Institución activa</div>
                <div style={{ fontWeight: 600 }}>
                  {activeInstitutionName && activeInstitutionName.trim()
                    ? activeInstitutionName
                    : "Sin institución"}
                </div>
              </div>

              <div ref={menuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  style={{
                    padding: "8px 10px",
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  {userLabel} ▾
                </button>

                {menuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 8px)",
                      minWidth: 200,
                      border: "1px solid #e5e5e5",
                      borderRadius: 10,
                      background: "white",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                      padding: 8,
                    }}
                  >
                    <button
                      type="button"
                      onClick={goProfile}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 10px",
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                        borderRadius: 8,
                      }}
                    >
                      Profile
                    </button>

                    <div style={{ height: 1, background: "#eee", margin: "6px 0" }} />

                    <button
                      type="button"
                      onClick={onLogout}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 10px",
                        border: 0,
                        background: "transparent",
                        cursor: "pointer",
                        borderRadius: 8,
                        color: "crimson",
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div>
    </div>
  );
}