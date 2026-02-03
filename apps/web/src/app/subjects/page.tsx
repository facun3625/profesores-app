"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Subject = {
  id: string;
  name: string;
};

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

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setError("");

    const [subjectsData, meData] = await Promise.all([
      api<Subject[]>("/subjects"),
      api<MeResponse>("/me"),
    ]);

    setSubjects(subjectsData);
    setMe(meData);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createSubject() {
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    try {
      await api("/subjects", {
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

  const activeInstitutionName =
    me?.institutions.find(
      (i) => i.id === me.user.activeInstitutionId
    )?.name || "—";

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Materias</h1>

      <div style={{ marginBottom: 16, opacity: 0.8 }}>
        Institución activa: <b>{activeInstitutionName}</b>
      </div>

      {error && (
        <div style={{ border: "1px solid red", padding: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nueva materia"
          style={{ padding: 8, flex: 1 }}
        />
        <button onClick={createSubject} disabled={loading}>
          Crear
        </button>
      </div>

      {subjects.length === 0 ? (
        <div>No hay materias todavía.</div>
      ) : (
        <ul style={{ display: "grid", gap: 8 }}>
          {subjects.map((s) => (
  <li
    key={s.id}
    style={{
      padding: 12,
      border: "1px solid",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    }}
  >
    <div style={{ fontWeight: 700 }}>{s.name}</div>
    <a href={`/subjects/${s.id}/topics`}>Temas</a>
  </li>
))}

        </ul>
      )}
    </main>
  );
}
