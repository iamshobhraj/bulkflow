import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

/* ========= Config ========= */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const DISPLAY_TZ = "Asia/Kolkata"; // change if you prefer another timezone
const TOKEN_KEY = "bulkflow_admin_token";

/* ========= Time helpers ========= */
function toUtcString(d: Date) {
  return d.toISOString().slice(0, 19).replace("T", " "); // "YYYY-MM-DD HH:MM:SS" (UTC)
}
function parseUtc(tsUtc: string) {
  return new Date(tsUtc.replace(" ", "T") + "Z").getTime();
}
function fmtLocal(tsUtc: string, withDate = true) {
  const d = new Date(tsUtc.replace(" ", "T") + "Z");
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TZ,
    ...(withDate ? { dateStyle: "medium" } : {}),
    timeStyle: "short",
    hour12: false,
  }).format(d);
}

/* ========= API helper ========= */
const api = axios.create({
  baseURL: API_BASE,
});
api.interceptors.request.use((config) => {
  const token =
    (typeof window !== "undefined" && localStorage.getItem(TOKEN_KEY)) || null;

  if (token) {
    (config.headers ??= {} as any);
    (config.headers as any)["x-admin-token"] = token;
  }
  return config;
});


/* ========= Types ========= */
type Service = { id: string; name: string; duration_min: number; active: number };
type Slot = { id: string; service_id: string; start_ts: string; end_ts: string; capacity: number; booked_count: number };
type Booking = { id: string; chat_id: string; status: string; service: string; start_ts: string };

/* ========= Page ========= */
export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // form fields
  const [date, setDate] = useState("");     // "YYYY-MM-DD" (local)
  const [time, setTime] = useState("");     // "HH:MM" (local)
  const [duration, setDuration] = useState<number>(30);
  const [capacity, setCapacity] = useState<number>(1);

  /* ----- auth boot ----- */
  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) setToken(t);
  }, []);

  /* ----- load data ----- */
  async function refresh() {
    setMsg("");
    try {
      const [svc, sl, bk] = await Promise.all([
        api.get("/admin/services/list"),
        api.get("/admin/slots/list", { params: { available: "1" } }), // server already future-filters
        api.get("/admin/bookings/recent"),
      ]);
      setServices(svc.data.results || []);
      setSlots(sl.data.results || []);
      setBookings(bk.data.results || []);
      if (!selected && (svc.data.results || []).length) setSelected(svc.data.results[0].id);
    } catch (e: any) {
      setMsg(e?.response?.data || e?.message || "Load failed");
    }
  }
  useEffect(() => { if (token) refresh(); }, [token]);

  /* ----- login / logout ----- */
  function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) return setMsg("Enter ADMIN_TOKEN");
    localStorage.setItem(TOKEN_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
    setTokenInput("");
    setMsg("");
  }
  function onLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setServices([]);
    setSlots([]);
    setBookings([]);
  }

  /* ----- seed ----- */
  async function onSeed() {
    setBusy(true); setMsg("");
    try {
      await api.post("/admin/seed");
      setMsg("Seeded demo service & slots.");
      await refresh();
    } catch (e: any) {
      setMsg(e?.response?.data || e?.message || "Seed failed");
    } finally { setBusy(false); }
  }

  /* ----- create slot (LOCAL → UTC) ----- */
  async function onCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !date || !time || !duration || !capacity) {
      setMsg("Fill all slot fields."); return;
    }
    const localStart = new Date(`${date}T${time}:00`);
    const start_ts = toUtcString(localStart);
    const end_ts = toUtcString(new Date(localStart.getTime() + duration * 60_000));

    setBusy(true); setMsg("");
    try {
      await api.post("/admin/slots/create", {
        service_id: selected, start_ts, end_ts, capacity
      });
      setMsg("Slot created.");
      setTime(""); setCapacity(1);
      await refresh();
    } catch (e: any) {
      setMsg(e?.response?.data || e?.message || "Create failed");
    } finally { setBusy(false); }
  }

  /* ----- future-only client filter (belt & suspenders) ----- */
  const futureSlots = useMemo(() => {
    const now = Date.now();
    const graceMs = 2 * 60 * 1000;
    return (slots || []).filter(s => parseUtc(s.start_ts) > (now + graceMs));
  }, [slots]);

  /* ----- UI ----- */
  if (!token) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <h2 style={{ marginTop: 0 }}>BulkFlow Admin</h2>
          <form onSubmit={onLogin}>
            <label style={styles.label}>Admin Token</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type={showToken ? "text" : "password"}
                placeholder="ADMIN_TOKEN"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={styles.input}
              />
              <button type="button" onClick={() => setShowToken(s => !s)} style={styles.buttonGhost}>
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <button type="submit" style={styles.buttonPrimary}>Login</button>
          </form>
          {msg && <p style={styles.msg}>{msg}</p>}
          <p style={{ color: "#666", fontSize: 12, marginTop: 12 }}>
            Your token is stored only in your browser (localStorage) and sent as <code>x-admin-token</code> to the API.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.topbar}>
        <div>
          <strong>BulkFlow Admin</strong>
          <span style={{ marginLeft: 12, color: "#888" }}>API: {API_BASE || "(relative /api)"}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={refresh} disabled={busy} style={styles.buttonGhost}>Refresh</button>
          <button onClick={onSeed} disabled={busy} style={styles.buttonGhost}>Seed demo</button>
          <button onClick={onLogout} style={styles.buttonDanger}>Logout</button>
        </div>
      </div>

      {msg && <p style={styles.msg}>{msg}</p>}

      <div style={styles.grid}>
        {/* Services */}
        <div style={styles.card}>
          <h3>Services</h3>
          {!services.length && <p>No services yet.</p>}
          {!!services.length && (
            <select value={selected} onChange={(e) => setSelected(e.target.value)} style={styles.input}>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <p style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
            Need more services? Use the API: <code>POST /admin/services/create</code>
          </p>
        </div>

        {/* Create Slot */}
        <div style={styles.card}>
          <h3>Create Slot</h3>
          <form onSubmit={onCreateSlot}>
            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={styles.input} />
              </div>
              <div style={{ width: 140 }}>
                <label style={styles.label}>Start (local)</label>
                <input type="time" value={time} onChange={e => setTime(e.target.value)} style={styles.input} />
              </div>
              <div style={{ width: 120 }}>
                <label style={styles.label}>Duration (min)</label>
                <input type="number" min={5} step={5} value={duration}
                  onChange={e => setDuration(Number(e.target.value))} style={styles.input} />
              </div>
              <div style={{ width: 120 }}>
                <label style={styles.label}>Capacity</label>
                <input type="number" min={1} step={1} value={capacity}
                  onChange={e => setCapacity(Number(e.target.value))} style={styles.input} />
              </div>
            </div>
            <button type="submit" disabled={busy || !selected || !date || !time} style={styles.buttonPrimary}>
              Create
            </button>
          </form>
          <p style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
            Saved as UTC in DB; displayed in {DISPLAY_TZ}.
          </p>
        </div>

        {/* Future Slots */}
        <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <h3>Future Slots (Available)</h3>
          {!futureSlots.length && <p>No upcoming available slots.</p>}
          {!!futureSlots.length && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Service</th><th>Start</th><th>End</th><th>Cap</th><th>Booked</th>
                </tr>
              </thead>
              <tbody>
                {futureSlots.map(s => (
                  <tr key={s.id}>
                    <td>{s.service_id}</td>
                    <td>{fmtLocal(s.start_ts)}</td>
                    <td>{fmtLocal(s.end_ts)}</td>
                    <td>{s.capacity}</td>
                    <td>{s.booked_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Bookings */}
        <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <h3>Recent Bookings</h3>
          {!bookings.length && <p>No bookings yet.</p>}
          {!!bookings.length && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>ID</th><th>Service</th><th>Start</th><th>Status</th><th>Chat</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontFamily: "monospace" }}>{b.id.slice(0, 8)}…</td>
                    <td>{b.service}</td>
                    <td>{fmtLocal(b.start_ts)}</td>
                    <td>{b.status}</td>
                    <td>{b.chat_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <footer style={{ color: "#888", fontSize: 12, margin: "24px 0" }}>
        Need raw JSON? <code>GET /admin/slots/list?available=1</code> and <code>GET /admin/bookings/recent</code>
      </footer>
    </div>
  );
}

/* ========= styles ========= */
const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 960, margin: "24px auto", padding: "0 16px", fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  card: { background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" },
  row: { display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 12 },
  label: { display: "block", fontSize: 12, color: "#666", marginBottom: 6 },
  input: { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ccc" },
  buttonPrimary: { padding: "8px 12px", borderRadius: 8, border: "1px solid #1a73e8", background: "#1a73e8", color: "#fff", cursor: "pointer" },
  buttonGhost: { padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", background: "#fafafa", cursor: "pointer" },
  buttonDanger: { padding: "8px 12px", borderRadius: 8, border: "1px solid #e53e3e", background: "#e53e3e", color: "#fff", cursor: "pointer" },
  msg: { background: "#fff7e6", border: "1px solid #ffe58f", padding: 10, borderRadius: 8 },
  table: { width: "100%", borderCollapse: "collapse" },
};

/* table styles */
(Object.assign as any)(styles, {
  tableThTd: {
    padding: "8px 10px", borderBottom: "1px solid #eee", textAlign: "left", fontSize: 14,
  },
});
