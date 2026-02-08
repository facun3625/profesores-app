// apps/web/src/lib/auth.ts
import { api } from "./api";

function setAccessToken(token: string) {
  // localStorage (para api.ts)
  localStorage.setItem("accessToken", token);

  // cookie (para middleware/server)
  document.cookie = `accessToken=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${
    60 * 60 * 24 * 7
  }`;
}

function clearAccessToken() {
  localStorage.removeItem("accessToken");
  document.cookie = "accessToken=; Path=/; Max-Age=0; SameSite=Lax";
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
  institutionName: string
) {
  const data = await api<any>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, institutionName }),
  });

  const token = pickToken(data);
  if (!token) throw new Error("Register OK pero no vino token/accessToken.");

  setAccessToken(token);
  return data;
}

export function logout() {
  clearAccessToken();
}

export async function getMe() {
  return api("/auth/me");
}