import { api } from "@/lib/api";

/**
 * Trae todas las preguntas de un listado recorriendo las páginas
 * (la API devuelve como máximo 100 por página).
 */
export async function fetchAllQuestions<T = Record<string, unknown>>(
  params: Record<string, string | undefined>
): Promise<T[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  qs.set("limit", "100");

  const out: T[] = [];
  for (let page = 1; ; page++) {
    qs.set("page", String(page));
    const r = await api<{ data: T[]; meta?: { totalPages?: number } }>(`/questions?${qs.toString()}`);
    out.push(...(r.data ?? []));
    if (page >= (r.meta?.totalPages ?? 1)) break;
  }
  return out;
}
