"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

function ProflyLogo() {
  return (
    <div className="select-none text-center">
      <div
        className="text-4xl font-semibold tracking-tight text-blue-600 font-[family-name:var(--font-logo)]"
      >
        profly
      </div>
      <div className="mt-1 text-xs text-gray-500">
        Gestión Inteligente de Exámenes
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const queryClient = useQueryClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validaciones preventivas en español
    if (!email.trim()) {
      setError("Por favor, ingresá tu email.");
      return;
    }
    if (!password) {
      setError("La contraseña es obligatoria.");
      return;
    }

    setLoading(true);

    try {
      await login(email.trim(), password);

      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email.trim());
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      // ✅ Invalidar todo para que el Dashboard pida datos frescos con el nuevo token/contexto
      await queryClient.invalidateQueries();
      router.push("/");
    } catch (err: any) {
      // Intento de traducir errores comunes del servidor
      const msg = err?.message || "";
      if (msg.includes("Su cuenta está inactiva") || msg.includes("info@profly.com.ar")) {
        setError(msg);
      } else if (msg.includes("Invalid credentials") || msg.includes("Unauthorized")) {
        setError("Email o contraseña incorrectos.");
      } else if (msg.includes("Network Error") || msg.includes("fetch")) {
        setError("Error de conexión. Verificá tu internet.");
      } else {
        setError(msg || "Ocurrió un error al intentar ingresar.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex">
      {/* Panel Izquierdo: Branding (Solo en Desktop) */}
      <div className="hidden lg:flex lg:w-[40%] flex-col items-center justify-center bg-blue-600 p-12 text-white relative h-screen sticky top-0 shadow-2xl z-10">
        <div className="max-w-md text-center space-y-3">
          <div className="text-5xl font-semibold tracking-tighter font-[family-name:var(--font-logo)]">
            profly
          </div>
          <p className="text-lg font-medium opacity-80">
            Gestión Inteligente de Exámenes
          </p>
        </div>

        {/* Decoración sutil */}
        <div className="absolute inset-x-0 bottom-12 text-center text-sm opacity-60 font-[family-name:var(--font-logo)]">
          © {new Date().getFullYear()} profly
        </div>
      </div>

      {/* Panel Derecho: Formulario Estilo DonWeb */}
      <div className="flex-1 flex flex-col justify-center items-center relative overflow-hidden bg-white">
        <div className="w-full max-w-sm px-8 pb-12 -mt-16">
          {/* Logo móvil (Solo visible en pantallas pequeñas) */}
          <div className="mb-10 lg:hidden text-center">
            <ProflyLogo />
          </div>

          <div className="space-y-8">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Acceder</h1>
              <p className="mt-2 text-sm text-gray-500">
                ¿No tienes cuenta aún?{" "}
                <a href="/register" className="text-blue-600 font-semibold hover:underline">
                  Créala desde aquí
                </a>
              </p>
            </div>

            {/* Botón de Google */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M 22.56 12.25 c 0 -0.78 -0.07 -1.53 -0.2 -2.25 H 12 v 4.26 h 5.92 c -0.26 1.37 -1.04 2.53 -2.21 3.31 v 2.77 h 3.57 c 2.08 -1.92 3.28 -4.74 3.28 -8.09 z"
                  fill="#4285F4"
                />
                <path
                  d="M 12 23 c 2.97 0 5.46 -0.98 7.28 -2.66 l -3.57 -2.77 c -0.98 0.66 -2.23 1.06 -3.71 1.06 -2.86 0 -5.29 -1.93 -6.16 -4.53 H 2.18 v 2.84 C 3.99 20.53 7.7 23 12 23 z"
                  fill="#34A853"
                />
                <path
                  d="M 5.84 14.09 c -0.22 -0.66 -0.35 -1.36 -0.35 -2.09 s 0.13 -1.43 0.35 -2.09 V 7.07 H 2.18 C 1.43 8.55 1 10.22 1 12 s 0.43 3.45 1.18 4.93 l 3.66 -2.84 z"
                  fill="#FBBC05"
                />
                <path
                  d="M 12 5.38 c 1.62 0 3.06 0.56 4.21 1.66 l 3.15 -3.15 C 17.45 2.09 14.97 1 12 1 C 7.7 1 3.47 2.18 7.07 l 3.66 2.84 c 0.87 -2.6 3.3 -4.53 6.16 -4.53 z"
                  fill="#EA4335"
                />
              </svg>
              Continuar con Google
            </button>


            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email o ID de Cliente"
                  className="w-full h-12 rounded-xl border border-gray-100 bg-gray-50/50 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900"
                />
              </div>

              <div className="space-y-1">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="w-full h-12 rounded-xl border border-gray-100 bg-gray-50/50 px-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all text-gray-900"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="rememberMe" className="text-xs font-medium text-gray-500 select-none cursor-pointer hover:text-gray-900">
                    Recordarme
                  </label>
                </div>

                <a
                  href="/forgot-password"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
                >
                  Olvidé mi contraseña
                </a>
              </div>

              {error && (
                <div className="rounded-xl border border-red-50 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/10 transition-all hover:bg-blue-700 hover:shadow-blue-500/20 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none mt-2"
              >
                {loading ? "Ingresando..." : "Acceder"}
              </button>
            </form>
          </div>

          <div className="mt-8 text-center lg:hidden">
            <p className="text-xs text-gray-400 font-[family-name:var(--font-logo)]">
              © {new Date().getFullYear()} profly
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}