"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Institution = {
  id: string;
  name: string;
  plan?: string;
  role?: string;
  status?: string;
};

type MeAny =
  | {
      activeInstitutionId?: string | null;
      user?: { activeInstitutionId?: string | null } | null;
    }
  | null;

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [activeInstitutionId, setActiveInstitutionId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function load() {
    setError("");

    const instRes = await Promise.allSettled([api<Institution[]>("/institutions")]);

    if (instRes[0].status === "fulfilled") {
      setInstitutions(instRes[0].value ?? []);
    } else {
      setError((instRes[0] as PromiseRejectedResult).reason?.message || "Error cargando instituciones");
    }

    let me: MeAny = null;
    try {
      me = await api<MeAny>("/auth/me");
    } catch {
      try {
        me = await api<MeAny>("/me");
      } catch {
        me = null;
      }
    }

    const activeId = me?.user?.activeInstitutionId ?? me?.activeInstitutionId ?? null;
    setActiveInstitutionId(activeId);
  }

  useEffect(() => {
    load();
  }, []);

  async function createInstitution() {
    setError("");
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      await api("/institutions", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      setName("");
      await load();
    } catch (e: any) {
      setError(e.message || "Error creando institución");
    } finally {
      setLoading(false);
    }
  }

  async function activateInstitution(institutionId: string) {
    setError("");
    setLoading(true);
    try {
      await api("/institutions/active", {
        method: "POST",
        body: JSON.stringify({ institutionId }),
      });

      setActiveInstitutionId(institutionId);

      // 🔥 AVISAMOS AL HEADER (ClientLayout) QUE CAMBIÓ LA ACTIVA
      window.dispatchEvent(new Event("active-institution-changed"));

      await load();
    } catch (e: any) {
      setError(e.message || "Error activando institución");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Instituciones</h1>

      {error && (
        <div style={{ border: "1px solid red", padding: 10, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <b>Activa:</b> {activeInstitutionId ?? "—"}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva institución"
          style={{ flex: 1 }}
        />
        <button disabled={loading} onClick={createInstitution}>
          Crear
        </button>
      </div>

      <div style={{ border: "1px solid #ddd" }}>
        {institutions.length ? (
          institutions.map((inst) => {
            const isActive = inst.id === activeInstitutionId;

            return (
              <div
                key={inst.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: 12,
                  borderTop: "1px solid #eee",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{inst.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {inst.plan ? `plan: ${inst.plan}` : "plan: —"}
                    {" · "}
                    {inst.role ? `role: ${inst.role}` : "role: —"}
                    {inst.status ? ` · status: ${inst.status}` : ""}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>{inst.id}</div>
                </div>

                {isActive ? (
                  <button disabled style={{ opacity: 0.6 }}>
                    Activa
                  </button>
                ) : (
                  <button disabled={loading} onClick={() => activateInstitution(inst.id)}>
                    Activar
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ padding: 12 }}>No hay instituciones todavía.</div>
        )}
      </div>
    </main>
  );
}