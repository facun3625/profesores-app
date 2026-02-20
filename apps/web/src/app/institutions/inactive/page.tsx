"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useIsAdmin } from "@/lib/hooks";
import { toast } from "sonner";
import Link from "next/link";

type Institution = {
    id: string;
    name: string;
    status: "active" | "inactive";
};

function Badge({
    children,
    tone = "neutral",
}: {
    children: React.ReactNode;
    tone?: "neutral" | "red" | "green" | "gray";
}) {
    const cls =
        tone === "red"
            ? "border-red-200 bg-red-50 text-red-700"
            : tone === "green"
                ? "border-green-200 bg-green-50 text-green-700"
                : tone === "gray"
                    ? "border-gray-200 bg-gray-50 text-gray-700"
                    : "border-gray-200 bg-white text-gray-700";

    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${cls}`}>
            {children}
        </span>
    );
}

export default function InactiveInstitutionsPage() {
    const isAdmin = useIsAdmin();
    const [institutions, setInstitutions] = useState<Institution[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [confirmName, setConfirmName] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function load() {
        try {
            const list = await api<Institution[]>("/institutions");
            // Filtrar por inactivas (el backend devuelve todas para el admin)
            setInstitutions(list.filter(i => i.status === "inactive"));
        } catch (e: any) {
            toast.error(e.message || "Error cargando instituciones");
        }
    }

    useEffect(() => {
        load().finally(() => setInitialLoading(false));
    }, []);

    async function restore(id: string) {
        setLoading(true);
        try {
            await api(`/institutions/${id}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status: "active" }),
            });
            toast.success("Institución restaurada");
            await load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function permanentlyDelete(inst: Institution) {
        if (confirmName !== inst.name) {
            toast.error("El nombre no coincide");
            return;
        }

        setLoading(true);
        try {
            await api(`/institutions/${inst.id}`, {
                method: "DELETE",
            });
            toast.success("Institución eliminada permanentemente");
            setDeletingId(null);
            setConfirmName("");
            await load();
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoading(false);
        }
    }

    if (!isAdmin && !initialLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900">Acceso denegado</h1>
                    <p className="mt-2 text-gray-600">Solo administradores pueden acceder a esta zona.</p>
                    <Link href="/institutions" className="mt-4 inline-block text-blue-600 hover:underline">
                        Volver a instituciones
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="mx-auto w-full max-w-4xl">
                <div className="mb-8">
                    <Link href="/institutions" className="mb-4 inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Volver a instituciones
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-red-900">Zona de Seguridad</h1>
                        <Badge tone="red">Peligro</Badge>
                    </div>
                    <p className="mt-1 text-gray-600">
                        Acá están las instituciones desactivadas. Podés restaurarlas o borrarlas para siempre.
                    </p>
                </div>

                <div className="rounded-2xl border border-red-200 bg-white shadow-xl overflow-hidden">
                    <div className="bg-red-50 px-6 py-4 border-b border-red-200">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-red-800">
                            Instituciones Inactivas
                        </h2>
                    </div>

                    {initialLoading ? (
                        <div className="p-12 text-center text-gray-500">Cargando zona de seguridad...</div>
                    ) : institutions.length === 0 ? (
                        <div className="p-12 text-center">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-300 mb-4">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            <p className="text-gray-600 font-medium">No hay instituciones inactivas.</p>
                            <p className="text-sm text-gray-400 mt-1">Todo está en orden.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {institutions.map((inst) => (
                                <div key={inst.id} className="p-6">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{inst.name}</h3>
                                            <p className="text-sm font-mono text-gray-400">{inst.id}</p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => restore(inst.id)}
                                                disabled={loading}
                                                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 transition"
                                            >
                                                Restaurar
                                            </button>
                                            <button
                                                onClick={() => setDeletingId(inst.id)}
                                                disabled={loading}
                                                className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 transition"
                                            >
                                                Borrar para siempre
                                            </button>
                                        </div>
                                    </div>

                                    {deletingId === inst.id && (
                                        <div className="mt-6 rounded-xl border-2 border-red-500 bg-red-50 p-6 animate-in fade-in slide-in-from-top-4">
                                            <h4 className="text-sm font-bold text-red-900 mb-2 uppercase tracking-tight">
                                                ⚠️ Acción Irreversible
                                            </h4>
                                            <p className="text-sm text-red-800 mb-4">
                                                Se borrarán permanentemente todas las materias, temas, preguntas y exámenes asociados a <b>{inst.name}</b>.
                                            </p>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs font-bold text-red-700 uppercase">
                                                        Escribí el nombre para confirmar:
                                                    </label>
                                                    <input
                                                        autoFocus
                                                        value={confirmName}
                                                        onChange={(e) => setConfirmName(e.target.value)}
                                                        className="mt-1 block w-full rounded-md border-red-300 bg-white px-3 py-2 text-sm text-red-900 outline-none focus:ring-2 focus:ring-red-500/20"
                                                        placeholder={inst.name}
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => permanentlyDelete(inst)}
                                                        disabled={loading || confirmName !== inst.name}
                                                        className="flex-1 rounded-md bg-red-600 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40 transition"
                                                    >
                                                        {loading ? "Borrando..." : "ELIMINAR DEFINITIVAMENTE"}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setDeletingId(null);
                                                            setConfirmName("");
                                                        }}
                                                        disabled={loading}
                                                        className="px-4 py-2 text-sm font-medium text-red-700 hover:underline"
                                                    >
                                                        Basta, me arrepentí
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
