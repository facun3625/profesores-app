"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!email.trim()) {
            setError("Por favor, ingresá tu email.");
            return;
        }

        setLoading(true);

        try {
            await api("/auth/forgot-password", {
                method: "POST",
                body: JSON.stringify({ email: email.trim() }),
            });
            setSuccess(true);
        } catch (err: any) {
            setError(err?.message || "Ocurrió un error al procesar tu solicitud.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <div className="mb-8">
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver al login
                    </Link>
                </div>

                {!success ? (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Mail className="w-8 h-8 text-blue-600" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900">¿Olvidaste tu contraseña?</h1>
                            <p className="mt-2 text-sm text-gray-500">
                                No te preocupes. Ingresá tu email y te enviaremos un link para crear una nueva.
                            </p>
                        </div>

                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-1">
                                <label htmlFor="email" className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-1">
                                    Email de registro
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com"
                                    className="w-full h-12 rounded-xl border border-gray-100 bg-gray-50 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all"
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2 border border-red-100">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 rounded-xl bg-blue-600 text-sm font-bold text-white shadow-lg shadow-blue-500/10 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-60"
                            >
                                {loading ? "Enviando..." : "Enviar link de recuperación"}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">¡Email enviado!</h2>
                        <p className="mt-4 text-gray-600 leading-relaxed">
                            Si existe una cuenta asociada a <strong>{email}</strong>, recibirás un correo con instrucciones en unos minutos.
                        </p>
                        <p className="mt-2 text-sm text-gray-500">
                            No olvides revisar tu carpeta de spam.
                        </p>
                        <div className="mt-8">
                            <Link
                                href="/login"
                                className="text-blue-600 font-bold hover:underline"
                            >
                                Ir al login
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
