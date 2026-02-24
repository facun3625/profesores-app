"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "@/lib/api";
import Link from "next/link";


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

  async function onGoogleSuccess(credentialResponse: any) {
    if (!credentialResponse.credential) return;
    setError(null);
    setLoading(true);

    try {
      const data = await api<{ accessToken: string }>("/auth/google-login", {
        method: "POST",
        body: JSON.stringify({
          idToken: credentialResponse.credential,
        }),
      });

      const { accessToken } = data;
      localStorage.setItem("accessToken", accessToken);
      document.cookie = `accessToken=${accessToken}; path=/; max-age=1209600; SameSite=Lax`;

      await queryClient.invalidateQueries();
      router.push("/");
    } catch (err: any) {
      console.error("[Login] Google login error:", err);
      setError(err?.message || "Falla al iniciar sesión con Google");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex">
      {/* Panel Izquierdo: Branding (Solo en Desktop) */}
      <div className="hidden lg:flex lg:w-[40%] flex-col items-center justify-center bg-blue-600 p-12 text-white relative h-screen sticky top-0 shadow-2xl z-10">
        <div className="max-w-md text-center space-y-3">
          <div className="text-5xl font-medium font-logo">
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
            <span className="text-4xl font-medium text-blue-600 font-logo">profly</span>
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

            {/* Botón de Google Funcional - Solo si hay Client ID */}
            {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={() => {
                    setError("Error en la autenticación con Google");
                  }}
                  theme="outline"
                  shape="pill"
                />
              </div>
            )}


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

                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap"
                >
                  Olvidé mi contraseña
                </Link>
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