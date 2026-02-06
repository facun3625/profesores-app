"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Institution = {
  id: string;
  name: string;
};

type MeAny =
  | {
      activeInstitutionId?: string | null;
      user?: { activeInstitutionId?: string | null } | null;
      institutions?: Institution[];
    }
  | null;

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [me, setMe] = useState<MeAny>(null);
  const [loadingLogout, setLoadingLogout] = useState(false);

  async function loadMe() {
    let res: MeAny = null;

    try {
      res = await api<MeAny>("/auth/me");
    } catch {
      try {
        res = await api<MeAny>("/me");
      } catch {
        res = null;
      }
    }

    setMe(res);
  }

  useEffect(() => {
    let mounted = true;

    async function firstLoad() {
      if (!mounted) return;
      await loadMe();
    }

    function onInstitutionChanged() {
      loadMe();
    }

    firstLoad();

    window.addEventListener("active-institution-changed", onInstitutionChanged);

    return () => {
      mounted = false;
      window.removeEventListener("active-institution-changed", onInstitutionChanged);
    };
  }, []);

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
      // aunque falle, forzamos logout local igual
    } finally {
      window.location.href = "/login";
    }
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
    Institución activa: <b>{activeInstitutionName}</b>
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