// ─── API Client ──────────────────────────────────────────────────────────────
//
// Centralized fetch wrapper for all backend calls. Attaches the stored JWT
// (if any) as a Bearer token and normalizes error handling so callers can
// just `await apiFetch<T>(...)` and catch a plain Error.

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

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
    throw new Error(error.message ?? `HTTP ${response.status}`);
  }

  return response.json();
}
