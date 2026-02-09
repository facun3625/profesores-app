"use client";

import { useEffect, useMemo, useState } from "react";
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

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "gray" | "emerald";
}) {
  const cls =
    tone === "blue"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : tone === "green"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "gray"
      ? "border-gray-200 bg-gray-50 text-gray-700"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-gray-200 bg-white text-gray-700";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs",
        cls
      )}
    >
      {children}
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12px] text-gray-500">{children}</span>;
}

function highlight(text: string, q: string) {
  const query = q.trim();
  if (!query) return text;

  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;

  const a = text.slice(0, idx);
  const b = text.slice(idx, idx + query.length);
  const c = text.slice(idx + query.length);

  return (
    <>
      {a}
      <mark className="rounded bg-yellow-100 px-1 text-gray-900">{b}</mark>
      {c}
    </>
  );
}

export default function TopicsPage() {
  const params = useParams();
  const subjectId = (params.subjectId as string) || "";

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  async function load() {
    setError("");

    if (!subjectId) {
      setSubject(null);
      setTopics([]);
      setError("Materia inválida");
      setInitialLoading(false);
      return;
    }

    try {
      const [topicsData, subjectsData] = await Promise.all([
        api<Topic[]>(`/topics/subject/${subjectId}`),
        api<Subject[]>("/subjects"),
      ]);

      setTopics(Array.isArray(topicsData) ? topicsData : []);
      const list = Array.isArray(subjectsData) ? subjectsData : [];
      setSubject(list.find((s) => s.id === subjectId) || null);
    } catch (e: any) {
      setError(e?.message || "Error cargando temas");
      setTopics([]);
      setSubject(null);
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    setInitialLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  async function createTopic() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    setError("");

    try {
      await api("/topics", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, subjectId }),
      });

      setName("");
      setInitialLoading(true);
      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando tema");
    } finally {
      setLoading(false);
    }
  }

  const canCreate = name.trim().length > 0 && !loading;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    );
  }, [topics, search]);

  return (
    <main className="min-h-[calc(100vh-64px)] px-6 py-8">
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-50 via-white to-gray-100" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.10) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />

      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <a
              href="/subjects"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              ← Volver a materias
            </a>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-blue-900">
              Temas
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              Materia:{" "}
              <span className="font-semibold text-gray-900">
                {subject?.name || "—"}
              </span>{" "}
              {subjectId ? (
                <span className="ml-2">
                  <Mono>{subjectId}</Mono>
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge tone="blue">{topics.length} total</Badge>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">Nuevo tema</div>
              <div className="mt-1 text-sm text-gray-600">
                Poné el nombre y seguí. Después vienen las preguntas.
              </div>
            </div>

            <Badge tone="gray">Topics</Badge>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate) createTopic();
              }}
              placeholder="Ej: Fracciones"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />

            <button
              type="button"
              disabled={!canCreate}
              onClick={createTopic}
              className="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-md bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Creando..." : "Crear"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
  <div className="h-5 w-1 rounded-full bg-blue-600" />
  <div className="text-sm font-semibold uppercase tracking-wide text-blue-700">
    Tus temas
  </div>
</div>
              <div className="mt-1 text-sm text-gray-600">
                Entrá a gestionar preguntas para armar el banco.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-[320px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre o ID…"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <Badge tone="gray">{filtered.length}</Badge>
            </div>
          </div>

          {initialLoading ? (
            <div className="px-6 py-8 text-sm text-gray-600">Cargando…</div>
          ) : filtered.length ? (
            <div className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {highlight(t.name, search)}
                    </div>
                    <div className="mt-1">
                      <Mono>{highlight(t.id, search)}</Mono>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={`/topics/${t.id}/questions?subjectId=${subjectId}`}
                      className="inline-flex h-9 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Gestionar preguntas →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-sm text-gray-600">
              No hay resultados. Probá con otro nombre o pegá un ID.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}