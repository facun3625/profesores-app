import type { ApiError } from "@profesores-app/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3000";

/**
 * Custom error class for API errors
 */
export class ApiRequestError extends Error {
  statusCode: number;
  errors?: string[];

  constructor(message: string, statusCode: number, errors?: string[]) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

async function parseError(res: Response): Promise<ApiRequestError> {
  try {
    const data = (await res.json()) as ApiError;
    const messages = Array.isArray(data.message) ? data.message : [data.message];
    const mainMessage = messages[0] || data.error || `HTTP ${res.status}`;

    return new ApiRequestError(mainMessage, res.status, messages);
  } catch {
    return new ApiRequestError(`HTTP ${res.status}`, res.status);
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

  if (!res.ok) throw await parseError(res);
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

  if (!res.ok) throw await parseError(res);
  return await res.blob();
}