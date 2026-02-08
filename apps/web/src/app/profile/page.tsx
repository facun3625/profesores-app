"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, logout } from "@/lib/auth";

type MeResponse = {
  user?: { id: string; email: string; name?: string | null; activeInstitutionId?: string | null };
  activeInstitution?: { id: string; name: string } | null;
  activeInstitutionId?: string | null;
  institution?: { id: string; name: string } | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = (await getMe()) as any;
        if (cancelled) return;
        setMe(r);
        setErr(null);
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "No se pudo cargar el perfil");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const user = me?.user;
  const activeName =
    me?.activeInstitution?.name ??
    me?.institution?.name ??
    "Sin institución";

  const activeId =
    me?.activeInstitutionId ??
    me?.user?.activeInstitutionId ??
    me?.activeInstitution?.id ??
    me?.institution?.id ??
    null;

  function onLogout() {
    logout();
    router.push("/login");
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, marginBottom: 10 }}>Profile</h1>
        <p style={{ opacity: 0.8 }}>Cargando…</p>
      </main>
    );
  }

  if (err) {
    return (
      <main style={{ padding: 24 }}>
        <h1 style={{ fontSize: 28, marginBottom: 10 }}>Profile</h1>
        <p style={{ color: "crimson" }}>{err}</p>
        <button type="button" onClick={() => router.push("/")}>
          Volver
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>Profile</h1>

      <section style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, margin: 0, marginBottom: 12 }}>Cuenta</h2>

        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Nombre</div>
            <div style={{ fontWeight: 600 }}>{user?.name?.trim() || "—"}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Email</div>
            <div style={{ fontWeight: 600 }}>{user?.email || "—"}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>User ID</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
              {user?.id || "—"}
            </div>
          </div>
        </div>
      </section>

      <section style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, margin: 0, marginBottom: 12 }}>Institución</h2>

        <div style={{ display: "grid", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Activa</div>
            <div style={{ fontWeight: 600 }}>{activeName}</div>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Active Institution ID</div>
            <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
              {activeId || "—"}
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => router.push("/institutions")}>
          Ir a Instituciones
        </button>

        <button type="button" onClick={onLogout} style={{ color: "crimson" }}>
          Logout
        </button>
      </div>
    </main>
  );
}