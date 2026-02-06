"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";

type Institution = {
  id: string;
  name: string;
  plan?: string;
  status?: string;
  role?: string;
};

type MeAny =
  | {
      activeInstitutionId?: string | null;
      user?: { activeInstitutionId?: string | null } | null;
      institutions?: Institution[];
    }
  | null;

function hasAccessToken() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("accessToken");
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [me, setMe] = useState<MeAny>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);

  const isLoginRoute = pathname === "/login";
  const tokenPresent = useMemo(() => hasAccessToken(), []);

  async function loadMe() {
    if (!hasAccessToken()) {
      setMe(null);
      return;
    }

    setLoadingMe(true);

    let res: MeAny = null;

    try {
      res = await api<MeAny>("/auth/me");
    } catch {
      try {
        res = await api<MeAny>("/me");
      } catch {
        res = null;
      }
    } finally {
      setMe(res);
      setLoadingMe(false);
    }
  }

  useEffect(() => {
    if (isLoginRoute) return;

    if (!hasAccessToken()) {
      router.replace("/login");
      return;
    }

    loadMe();

    function onInstitutionChanged() {
      loadMe();
    }

    window.addEventListener("active-institution-changed", onInstitutionChanged);

    return () => {
      window.removeEventListener("active-institution-changed", onInstitutionChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoginRoute]);

  const activeInstitutionId =
    me?.user?.activeInstitutionId ?? me?.activeInstitutionId ?? null;

  const institutions = me?.institutions ?? [];

  const activeInstitutionName =
    institutions.find((i) => i.id === activeInstitutionId)?.name ?? "—";

  async function logout() {
    setLoadingLogout(true);

    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // aunque falle backend, limpiamos igual
    } finally {
      localStorage.removeItem("accessToken");
      setMe(null);
      setLoadingLogout(false);
      router.replace("/login");
    }
  }

  // ✅ No mostramos header en /login
  if (isLoginRoute) {
    return <main>{children}</main>;
  }

  // ✅ Si no hay token, evitamos renderizar header "falso" y navegamos a /login
  if (!hasAccessToken()) {
    return <main>{children}</main>;
  }

  return (
    <>
      <header
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #e5e5e5",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 700 }}>Profesores App</div>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="http://localhost:3001">🏠 Home</a>

          <span style={{ opacity: 0.8 }}>
            Institución activa:{" "}
            <b>{loadingMe ? "Cargando..." : activeInstitutionName}</b>
          </span>

          <a href="/institutions">Cambiar</a>

          <button disabled={loadingLogout} onClick={logout}>
            {loadingLogout ? "Cerrando..." : "Cerrar sesión"}
          </button>
        </div>
      </header>

      <main>{children}</main>
    </>
  );
}