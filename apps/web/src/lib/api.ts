const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3000";

type ApiError = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ApiError;
    if (Array.isArray(data.message)) return data.message.join(", ");
    return (data.message as string) || data.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function getAuthHeader(): HeadersInit {
  if (typeof window === "undefined") return {};

  const token =
    localStorage.getItem("accessToken") || localStorage.getItem("token");

  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as T;
}

export async function apiBlob(
  path: string,
  init: RequestInit = {}
): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...getAuthHeader(),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await parseError(res));
  return await res.blob();
}