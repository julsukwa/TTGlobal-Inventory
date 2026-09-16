// ─── API Client ──────────────────────────────────────────────────────────────
//
// Centralized fetch wrapper for all backend calls. Attaches the stored JWT
// (if any) as a Bearer token and normalizes error handling so callers can
// just `await apiFetch<T>(...)` and catch a plain Error.

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

// Carries the HTTP status alongside the message so callers can branch on it
// (e.g. a 409 conflict) without re-parsing the response themselves.
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("ttglobal_token");

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(error.message ?? `HTTP ${response.status}`, response.status);
  }

  return response.json();
}

// For non-JSON responses (e.g. a CSV/file download) where apiFetch's
// `.json()` parsing doesn't apply. Same auth header and error handling.
export async function apiFetchBlob(
  endpoint: string,
  options: RequestInit = {}
): Promise<Blob> {
  const token = localStorage.getItem("ttglobal_token");

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(error.message ?? `HTTP ${response.status}`, response.status);
  }

  return response.blob();
}
