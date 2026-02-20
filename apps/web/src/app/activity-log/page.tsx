"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type LogAction = "CREATE" | "UPDATE" | "DELETE";
type Actor = { id: string; name: string | null; lastName: string | null; email: string };
type LogEntry = {
    id: string;
    actorId: string;
    action: LogAction;
    entity: string;
    entityId: string;
    detail: any;
    createdAt: string;
    actor: Actor;
};

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

function actionLabel(a: LogAction) {
    if (a === "CREATE") return "Creó";
    if (a === "UPDATE") return "Editó";
    if (a === "DELETE") return "Eliminó";
    return a;
}

function actionColor(a: LogAction) {
    if (a === "CREATE") return "border-green-200 bg-green-50 text-green-700";
    if (a === "UPDATE") return "border-blue-200 bg-blue-50 text-blue-700";
    if (a === "DELETE") return "border-red-200 bg-red-50 text-red-700";
    return "border-gray-200 bg-gray-50 text-gray-700";
}

function formatDate(iso: string) {
    try {
        return new Intl.DateTimeFormat("es-AR", {
            dateStyle: "short",
            timeStyle: "short",
        }).format(new Date(iso));
    } catch {
        return iso;
    }
}

function actorName(actor: Actor) {
    return [actor.name, actor.lastName].filter(Boolean).join(" ") || actor.email;
}

export default function ActivityLogPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [actorFilter, setActorFilter] = useState("");
    const [actionFilter, setActionFilter] = useState<LogAction | "">("");

    async function load() {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams();
            if (from) params.set("from", new Date(from).toISOString());
            if (to) params.set("to", new Date(to + "T23:59:59").toISOString());
            const data = await api<LogEntry[]>(`/activity-log?${params.toString()}`);
            setLogs(Array.isArray(data) ? data : []);
        } catch (e: any) {
            setError(e?.message || "Error cargando logs");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    const filtered = useMemo(() => {
        return logs.filter((l) => {
            if (actorFilter && l.actorId !== actorFilter && !actorName(l.actor).toLowerCase().includes(actorFilter.toLowerCase())) return false;
            if (actionFilter && l.action !== actionFilter) return false;
            return true;
        });
    }, [logs, actorFilter, actionFilter]);

    const actors = useMemo(() => {
        const seen = new Map<string, Actor>();
        for (const l of logs) seen.set(l.actorId, l.actor);
        return Array.from(seen.values());
    }, [logs]);

    return (
        <main className="min-h-[calc(100vh-64px)] px-6 py-8">
            <div className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-50 via-white to-gray-100" />

            <div className="mx-auto w-full max-w-6xl">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-purple-900">
                            Registro de actividad
                        </h1>
                        <p className="mt-1 text-sm text-gray-600">
                            Historial de cambios realizados por vos y tus profesores.
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Filters */}
                <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 p-4 shadow-sm">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Desde</label>
                            <input
                                type="date"
                                value={from}
                                onChange={(e) => setFrom(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Hasta</label>
                            <input
                                type="date"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Profesor</label>
                            <select
                                value={actorFilter}
                                onChange={(e) => setActorFilter(e.target.value)}
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                            >
                                <option value="">Todos</option>
                                {actors.map((a) => (
                                    <option key={a.id} value={a.id}>{actorName(a)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Acción</label>
                            <select
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value as any)}
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                            >
                                <option value="">Todas</option>
                                <option value="CREATE">Creó</option>
                                <option value="UPDATE">Editó</option>
                                <option value="DELETE">Eliminó</option>
                            </select>
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={load}
                            className="inline-flex h-9 items-center rounded-md bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700"
                        >
                            {loading ? "Cargando…" : "Buscar"}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setFrom(""); setTo(""); setActorFilter(""); setActionFilter(""); }}
                            className="inline-flex h-9 items-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Limpiar
                        </button>
                    </div>
                </section>

                {/* Table */}
                <section className="mt-6 rounded-2xl border border-gray-200 bg-white/90 shadow-sm overflow-hidden">
                    <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-5 w-1 rounded-full bg-purple-600" />
                            <div className="text-sm font-semibold uppercase tracking-wide text-purple-700">
                                Eventos
                            </div>
                        </div>
                        <span className="text-xs text-gray-500">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
                    </div>

                    {loading ? (
                        <div className="px-6 py-12 text-center text-sm text-gray-400">Cargando…</div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 text-3xl">📋</div>
                            <div className="text-sm font-medium text-gray-700">Sin actividad registrada</div>
                            <p className="text-xs text-gray-400 max-w-xs">
                                Los cambios que hagas vos o tus profesores aparecerán acá.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filtered.map((l) => (
                                <div key={l.id} className="flex flex-col gap-1 px-6 py-3 sm:flex-row sm:items-start sm:gap-4">
                                    <div className="w-36 shrink-0 text-xs text-gray-400">{formatDate(l.createdAt)}</div>
                                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                                        <span
                                            className={cn(
                                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                                actionColor(l.action)
                                            )}
                                        >
                                            {actionLabel(l.action)}
                                        </span>
                                        <span className="text-sm font-medium text-gray-800 truncate">
                                            {actorName(l.actor)}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {l.entity === "exam" ? "un examen" : "una pregunta"}
                                            {(l.detail?.statement || l.detail?.title) && (
                                                <> — <span className="italic text-gray-400 truncate max-w-[260px] inline-block align-bottom">"{l.detail.statement || l.detail.title}"</span></>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
