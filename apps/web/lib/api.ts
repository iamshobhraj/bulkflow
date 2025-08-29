import axios from "axios";

export const TOKEN_KEY = "bulkflow_admin_token";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token =
    (typeof window !== "undefined" && localStorage.getItem(TOKEN_KEY)) || null;
  if (token) {
    (config.headers ??= {} as any);
    (config.headers as any)["x-admin-token"] = token;
  }
  return config;
});

export function setToken(t: string | null) {
  if (typeof window === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
