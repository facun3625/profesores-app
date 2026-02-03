// apps/web/src/lib/api.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const USER_ID = process.env.NEXT_PUBLIC_USER_ID!;

type ApiError = {
  message?: string;
  error?: string;
  statusCode?: number;
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ApiError;
    return data.message || data.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/**
 * Headers base compartidos por TODAS las llamadas
 * (clave: mismo user para generate + export)
 */
function baseHeaders(extra?: HeadersInit): HeadersInit {
  return {
    "x-user-id": USER_ID,
    ...(extra || {}),
  };
}

/**
 * API JSON (GET/POST/etc)
 */
export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...baseHeaders(init?.headers),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.json() as Promise<T>;
}

/**
 * API para descargar archivos (PDF, etc)
 * NO setea Content-Type y devuelve Blob
 */
export async function apiBlob(
  path: string,
  init?: RequestInit
): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: baseHeaders(init?.headers),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(await parseError(res));
  }

  return res.blob();
}
