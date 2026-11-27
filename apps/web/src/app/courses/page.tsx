"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Course, fetchCourses } from "@/lib/courses";

/**
 * Cursos / divisiones (ej: "3° B"). Se usan para asociar exámenes y para
 * evitar repetir preguntas con el mismo grupo de alumnos.
 */
export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [editing, setEditing] = useState<{ id: string; name: string; year: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCourses(await fetchCourses(showArchived));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron cargar los cursos");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    load();
  }, [load]);

  function parseYear(raw: string) {
    const n = Number(raw);
    return raw.trim() && Number.isInteger(n) ? n : undefined;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api("/courses", { method: "POST", body: JSON.stringify({ name: name.trim(), year: parseYear(year) }) });
      toast.success("Curso creado");
      setName("");
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el curso");
    }
  }

  async function update(id: string, data: Record<string, unknown>) {
    try {
      await api(`/courses/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      setEditing(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el curso");
    }
  }

  const input =
    "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Cursos</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Cargá tus cursos o divisiones (ej: &quot;3° B&quot;). Al armar un examen elegís el curso, y la app te avisa qué
          preguntas ya le tomaste a ese grupo.
        </p>
      </div>

      <form
        onSubmit={create}
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Nombre</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="3° B" maxLength={60} className={input} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Año lectivo</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" className={`${input} w-28`} />
        </label>
        <button
          type="submit"
          disabled={!name.trim()}
          className="h-10 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          Agregar curso
        </button>
      </form>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-slate-800">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Tus cursos</span>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Mostrar archivados
          </label>
        </div>

        {loading ? (
          <div className="px-5 py-6 text-sm text-gray-500">Cargando…</div>
        ) : courses.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">Todavía no cargaste cursos.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-800">
            {courses.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                {editing?.id === c.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      className={input}
                    />
                    <input
                      value={editing.year}
                      onChange={(e) => setEditing({ ...editing, year: e.target.value })}
                      className={`${input} w-24`}
                    />
                    <button
                      type="button"
                      onClick={() => update(c.id, { name: editing.name, year: parseYear(editing.year) })}
                      className="h-9 rounded-lg bg-amber-600 px-3 text-sm font-medium text-white"
                    >
                      Guardar
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className="h-9 px-2 text-sm text-gray-600">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                    {c.year ? <span className="ml-2 text-sm text-gray-500">{c.year}</span> : null}
                    {c.archived ? (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">archivado</span>
                    ) : null}
                  </div>
                )}

                {editing?.id !== c.id && (
                  <div className="flex items-center gap-3 text-sm">
                    <Link href={`/exams?courseId=${c.id}`} className="text-blue-600 hover:underline">
                      {c._count?.exams ?? 0} examen(es)
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditing({ id: c.id, name: c.name, year: c.year ? String(c.year) : "" })}
                      className="text-gray-600 hover:underline dark:text-slate-400"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => update(c.id, { archived: !c.archived })}
                      className="text-gray-600 hover:underline dark:text-slate-400"
                    >
                      {c.archived ? "Reactivar" : "Archivar"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
