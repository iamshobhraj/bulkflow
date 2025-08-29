export const API_BASE = process.env.NEXT_PUBLIC_API_BASE!

function getAdminToken(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem("bulkflow_admin_token")
}
export function setAdminToken(t: string) { if (typeof window !== "undefined") window.localStorage.setItem("bulkflow_admin_token", t) }
export function clearAdminToken() { if (typeof window !== "undefined") window.localStorage.removeItem("bulkflow_admin_token") }

export async function req(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json")
  const token = getAdminToken()
  if (token) headers.set("x-admin-token", token)

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`${res.status} ${text || res.statusText}`)
  }
  return res.json()
}

export const api = {
  seed: () => req("/admin/seed", { method: "POST" }),
  services: {
    list: () => req("/admin/services/list"),
    create: (body: { id: string; name: string; duration_min: number; active?: number }) =>
      req("/admin/services/create", { method: "POST", body: JSON.stringify(body) }),
  },
  slots: {
    list: (serviceId: string) => req(`/admin/slots/list?service=${encodeURIComponent(serviceId)}`),
    create: (body: { service_id: string; start_ts: string; end_ts: string; capacity: number }) =>
      req("/admin/slots/create", { method: "POST", body: JSON.stringify(body) }),
  },
  bookings: {
    recent: () => req("/admin/bookings/recent"),
  },
}
