"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";

type Topic = {
  id: string;
  name: string;
  subjectId: string;
};

type Subject = {
  id: string;
  name: string;
};

export default function TopicsPage() {
  const params = useParams();
  const subjectId = params.subjectId as string;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setError("");

    if (!subjectId) {
      setError("Materia inválida");
      return;
    }

    const [topicsData, subjectsData] = await Promise.all([
      api<Topic[]>(`/topics/subject/${subjectId}`),
      api<Subject[]>("/subjects"),
    ]);

    setTopics(topicsData);
    setSubject(subjectsData.find((s) => s.id === subjectId) || null);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [subjectId]);

  async function createTopic() {
    if (!name.trim()) return;

    setLoading(true);
    setError("");

    try {
      await api("/topics", {
        method: "POST",
        body: JSON.stringify({ name, subjectId }),
      });
      setName("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <a href="/subjects">← Volver a materias</a>
      </div>

      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Temas</h1>

      <div style={{ marginBottom: 16, opacity: 0.8 }}>
        Materia: <b>{subject?.name || "—"}</b>
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
          placeholder="Nuevo tema"
          style={{ padding: 8, flex: 1 }}
        />
        <button onClick={createTopic} disabled={loading}>
          Crear
        </button>
      </div>

      {topics.length === 0 ? (
        <div>No hay temas todavía.</div>
      ) : (
        <ul style={{ display: "grid", gap: 8 }}>
          {topics.map((t) => (
  <li
    key={t.id}
    style={{
      padding: 12,
      border: "1px solid",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    }}
  >
    <div style={{ fontWeight: 700 }}>{t.name}</div>
    <a href={`/topics/${t.id}/questions?subjectId=${subjectId}`}>Gestionar preguntas</a>

  </li>
))}

        </ul>
      )}
    </main>
  );
}
