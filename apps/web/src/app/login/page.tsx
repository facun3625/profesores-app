"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";

function FluxLogo() {
  return (
    <div className="select-none text-center">
      <div
        className="text-4xl font-semibold tracking-tight text-blue-600"
        style={{
          fontFamily:
            "'Montserrat Alternates','Inter','Helvetica Neue',Arial,sans-serif",
        }}
      >
        flux
      </div>
      <div className="mt-1 text-xs text-gray-500">
       Texto
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("test+auth8@test.com");
  const [password, setPassword] = useState("12345678");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      router.push("/");
    } catch (err: any) {
      setError(err?.message ?? "Login error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4">
      {/* Fondo con gradient + grid sutil */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-gray-50 via-white to-gray-100" />
      <div
        className="fixed inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="mb-6">
            <FluxLogo />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white/90 backdrop-blur p-6 shadow-sm">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">Acceso</h1>
              <p className="mt-1 text-sm text-gray-500">Ingresá a tu cuenta</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>

              <div className="flex justify-end">
                <a
                  href="/forgot-password"
                  className="text-sm text-gray-500 hover:text-blue-600 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              <div className="text-center text-sm text-gray-600">
                ¿No tenés cuenta?{" "}
                <a
                  href="/register"
                  className="font-medium text-blue-600 hover:underline"
                >
                  Crear cuenta
                </a>
              </div>
            </form>
          </div>

          <div className="mt-6 text-center text-xs text-gray-500">
            © {new Date().getFullYear()} Flux
          </div>
        </div>
      </div>
    </main>
  );
}