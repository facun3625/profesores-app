"use client";

import { api } from "@/lib/api";

type Props = {
  activeInstitutionId: string | null;
};

export function AppHeader({ activeInstitutionId }: Props) {
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // aunque falle backend, limpiamos igual
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        borderBottom: "1px solid #e5e5e5",
      }}
    >
      <strong>Profesores App</strong>

      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span style={{ fontSize: 14 }}>
          Institución activa: {activeInstitutionId ?? "—"}
        </span>

        <button onClick={logout}>Cerrar sesión</button>
      </div>
    </header>
  );
}