"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePathname, useRouter } from "next/navigation";

type Institution = {
  id: string;
  name: string;
};

type MeResponse = {
  user?: {
    activeInstitutionId?: string | null;
  } | null;
  institutions?: Institution[];
} | null;

function hasToken() {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("accessToken");
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [me, setMe] = useState<MeResponse>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    async function checkSession() {
      const token = hasToken();

      // 🔴 No logueado
      if (!token) {
        if (!isLoginRoute) {
          router.replace("/login");
        }
        setCheckingAuth(false);
        return;
      }

      // 🔵 Logueado pero entra a /login
      if (isLoginRoute) {
        router.replace("/");
        return;
      }

      // 🔵 Validar sesión real contra backend
      try {
        const res = await api<MeResponse>("/auth/me");
        setMe(res);
      } catch {
        // token inválido o sesión caída
        localStorage.removeItem("accessToken");
        router.replace("/login");
        return;
      } finally {
        setCheckingAuth(false);
      }
    }

    checkSession();

    function onInstitutionChanged() {
      checkSession();
    }

    window.addEventListener("active-institution-changed", onInstitutionChanged);

    return () => {
      window.removeEventListener("active-institution-changed", onInstitutionChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 🕒 Pantalla de espera (sin flashes)
  if (checkingAuth) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        Cargando sesión…
      </div>
    );
  }

  // 🧼 Login sin header
  if (isLoginRoute) {
    return <main>{children}</main>;
  }

  const activeInstitutionId =
    me?.user?.activeInstitutionId ?? null;

  const institutions = me?.institutions ?? [];

  const activeInstitutionName =
    institutions.find((i) => i.id === activeInstitutionId)?.name ?? "—";

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
    } finally {
      localStorage.removeItem("accessToken");
      router.replace("/login");
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

          <span>
            Institución activa: <b>{activeInstitutionName}</b>
          </span>

          {institutions.length > 1 && <a href="/institutions">Cambiar</a>}

          <button onClick={logout}>Cerrar sesión</button>
        </div>
      </header>

      <main>{children}</main>
    </>
  );
}