// apps/web/src/lib/auth.ts
import { api } from "./api";

function setAccessToken(token: string) {
  // localStorage (para api.ts)
  localStorage.setItem("accessToken", token);

  // cookie (para middleware/server)
  document.cookie = `accessToken=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7
    }`;
}

function clearAccessToken() {
  localStorage.removeItem("accessToken");
  document.cookie = "accessToken=; Path=/; Max-Age=0; SameSite=Lax";
}

export function clearSession() {
  if (typeof window === "undefined") return;

  // Limpiar tokens
  clearAccessToken();

  // Limpiar cualquier otra variable de estado persistida
  localStorage.removeItem("me");
  localStorage.removeItem("activeInstitutionId");
  localStorage.removeItem("activeInstitutionName");
  localStorage.removeItem("profileData"); // Por si existe

  // Nota: Mantenemos 'theme' y 'rememberedEmail' por conveniencia del usuario
}

function pickToken(data: any): string | null {
  const t = data?.token ?? data?.accessToken ?? null;
  return typeof t === "string" && t.length ? t : null;
}

export async function login(email: string, password: string) {
  const data = await api<any>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const token = pickToken(data);
  if (!token) throw new Error("Login OK pero no vino token/accessToken.");

  setAccessToken(token);
  return data?.user ?? null;
}

export async function register(
  email: string,
  password: string,
  name: string,
  lastName: string,
  institutionName: string
) {
  const data = await api<any>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, lastName, institutionName }),
  });

  const token = pickToken(data);
  if (!token) throw new Error("Register OK pero no vino token/accessToken.");

  setAccessToken(token);
  return data;
}

export function logout() {
  clearSession();
}

export async function getMe() {
  return api("/auth/me");
}