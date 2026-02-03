"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Institution = {
  id: string;
  name: string;
};

type MeResponse = {
  user: {
    id: string;
    activeInstitutionId?: string | null;
  };
  institutions: Institution[];
};

export default function InstitutionsPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setError("");
    const data = await api<MeResponse>("/me");
    setMe(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createInstitution() {
    if (!name.trim()) return;

    setLoading(true);
    setError("");
    try {
      await api("/institutions", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function setActiveInstitution(institutionId: string) {
    setLoading(true);
    setError("");
    try {
      await api("/institutions/active", {
        method: "POST",
        body: JSON.stringify({ institutionId }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const activeId = me?.user.activeInstitutionId;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Instituciones</h1>

      <p style={{ marginBottom: 16, opacity: 0.8 }}>
        Solo una institución puede estar activa.  
        Todo lo que crees (materias, temas, exámenes) pertenece a la institución activa.
      </p>

      {error && (
        <div style={{ border: "1px solid red", padding: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva institución"
          style={{ padding: 8, flex: 1 }}
        />
        <button onClick={createInstitution} disabled={loading}>
          Crear
        </button>
      </div>

      {!me ? (
        <div>Cargando…</div>
      ) : (
        <ul style={{ display: "grid", gap: 12 }}>
          {me.institutions.map((inst) => {
            const isActive = inst.id === activeId;

            return (
              <li
                key={inst.id}
                style={{
                  padding: 16,
                  border: "1px solid",
                  background: isActive ? "#e6ffe6" : "transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{inst.name}</div>
                  {isActive && (
                    <div style={{ fontSize: 13, opacity: 0.7 }}>
                      Institución activa
                    </div>
                  )}
                </div>

                {!isActive && (
                  <button
                    onClick={() => setActiveInstitution(inst.id)}
                    disabled={loading}
                  >
                    Cambiar a esta institución
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
