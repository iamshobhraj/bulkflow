import { useEffect, useState } from "react";
import { api, setAdminToken, clearAdminToken, req } from "../lib/api";

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [services, setServices] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [slots, setSlots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    const t = typeof window !== "undefined" ? window.localStorage.getItem("bulkflow_admin_token") : null;
    if (!t) { setAuthed(false); return; }
    req("/admin/services/list").then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  async function login() {
    setBusy(true); setMsg("");
    try {
      setAdminToken(tokenInput.trim());
      await req("/admin/services/list");
      setAuthed(true); setMsg("Logged in.");
      await refresh();
    } catch (e:any) {
      clearAdminToken(); setAuthed(false); setMsg(e.message || "Invalid token");
    } finally { setBusy(false); }
  }
  function logout() {
    clearAdminToken(); setAuthed(false); setServices([]); setSlots([]); setBookings([]); setMsg("Logged out.");
  }

  async function refresh() {
    if (!authed) return;
    setBusy(true);
    try {
      const s: any = await api.services.list(); setServices(s.results || []);
      if (selected) { const sl: any = await api.slots.list(selected); setSlots(sl.results || []); } else setSlots([]);
      const b: any = await api.bookings.recent(); setBookings(b.results || []);
    } catch (e:any) { setMsg(e.message) } finally { setBusy(false) }
  }
  useEffect(() => { refresh(); }, [authed, selected]);

  async function onSeed() { setBusy(true); setMsg(""); try { await api.seed(); setMsg("Seeded demo service & slots."); await refresh(); } catch (e:any){ setMsg(e.message) } finally { setBusy(false) } }

  async function onCreateService(e:any) {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const id = String(form.get("id")||"").trim(), name = String(form.get("name")||"").trim(), duration = Number(form.get("duration")||0);
    if (!id || !name || !duration) return setMsg("Fill all service fields.");
    setBusy(true);
    try { await api.services.create({ id, name, duration_min: duration, active: 1 }); setMsg("Service created."); e.currentTarget.reset(); await refresh(); } catch(e:any){ setMsg(e.message) } finally { setBusy(false) }
  }

  async function onCreateSlot(e:any) {
    e.preventDefault(); const form = new FormData(e.currentTarget);
    const service_id = selected || String(form.get("service_id")||"").trim(); const date = String(form.get("date")||"").trim(); const start = String(form.get("start")||"").trim();
    const duration = Number(form.get("duration")||0); const capacity = Number(form.get("capacity")||0);
    if (!service_id || !date || !start || !duration || !capacity) return setMsg("Fill all slot fields.");
    const start_ts = `${date} ${start}:00`; const startDate = new Date(`${date}T${start}:00Z`);
    const end_ts = new Date(startDate.getTime() + duration * 60_000).toISOString().slice(0,19).replace("T"," ");
    setBusy(true);
    try { await api.slots.create({ service_id, start_ts, end_ts, capacity }); setMsg("Slot created."); e.currentTarget.reset(); await refresh(); } catch(e:any){ setMsg(e.message) } finally { setBusy(false) }
  }

  if (authed === false) {
    return (
      <main style={{maxWidth:380, margin:"15vh auto", fontFamily:"ui-sans-serif, system-ui"}}>
        <h1 style={{fontSize:22, fontWeight:700, marginBottom:12}}>BulkFlow Admin Login</h1>
        <p style={{opacity:.8, marginBottom:12}}>Enter your admin token to manage services, slots, and bookings.</p>
        <input placeholder="ADMIN_TOKEN" value={tokenInput} onChange={(e)=>setTokenInput(e.target.value)}
          style={{width:"100%", padding:10, borderRadius:8, border:"1px solid #ccc", marginBottom:10}} />
        <button onClick={login} disabled={busy} style={{padding:"8px 12px"}}>Login</button>
        {msg && <p style={{color:"#a00", marginTop:10}}>{msg}</p>}
      </main>
    )
  }

  if (authed === null) return <main style={{maxWidth:380, margin:"15vh auto"}}>Checking session…</main>

  return (
    <main style={{maxWidth:900, margin:"40px auto", fontFamily:"ui-sans-serif, system-ui"}}>
      <header style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
        <div><h1 style={{fontSize:26, fontWeight:700}}>BulkFlow Admin (Telegram Booking)</h1><p style={{opacity:.7}}>Manage services, slots, and bookings.</p></div>
        <div>
          <button onClick={refresh} disabled={busy} style={{marginRight:8}}>🔄 Refresh</button>
          <button onClick={onSeed} disabled={busy} style={{marginRight:8}}>🌱 Seed Demo</button>
          <button onClick={logout}>Logout</button>
        </div>
      </header>
      {msg && <div style={{margin:"8px 0", color:"#0a7"}}>{msg}</div>}

      <section style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginTop:12}}>
        <div style={{border:"1px solid #eee", borderRadius:12, padding:16}}>
          <h2 style={{fontSize:18, marginBottom:8}}>➕ New Service</h2>
          <form onSubmit={onCreateService} style={{display:"grid", gap:8}}>
            <input name="id" placeholder="id (e.g., demo_call)" />
            <input name="name" placeholder="name (Demo Call)" />
            <input name="duration" type="number" placeholder="duration (min)" defaultValue={30} />
            <button disabled={busy}>Create Service</button>
          </form>
        </div>

        <div style={{border:"1px solid #eee", borderRadius:12, padding:16}}>
          <h2 style={{fontSize:18, marginBottom:8}}>➕ New Slot</h2>
          <form onSubmit={onCreateSlot} style={{display:"grid", gap:8}}>
            <label>Service</label>
            <select name="service_id" value={selected} onChange={e=>setSelected(e.target.value)}>
              <option value="">— choose —</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
            <input name="date" type="date" />
            <input name="start" type="time" />
            <input name="duration" type="number" defaultValue={30} />
            <input name="capacity" type="number" defaultValue={1} />
            <button disabled={busy}>Create Slot</button>
          </form>
        </div>
      </section>

      <section style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginTop:24}}>
        <div style={{border:"1px solid #eee", borderRadius:12, padding:16}}>
          <h2 style={{fontSize:18, marginBottom:8}}>🧩 Services</h2>
          {!services.length && <p>No services yet.</p>}
          <ul>{services.map(s => <li key={s.id}>{s.name} <small style={{opacity:.6}}>(id: {s.id}, {s.duration_min}m)</small></li>)}</ul>
        </div>

        <div style={{border:"1px solid #eee", borderRadius:12, padding:16}}>
          <h2 style={{fontSize:18, marginBottom:8}}>⏱ Slots {selected && <small style={{opacity:.6}}>for {selected}</small>}</h2>
          {!slots.length && <p>Select a service to view slots.</p>}
          <ul>{slots.map(sl => <li key={sl.id}>{sl.start_ts} → {sl.end_ts} • cap {sl.capacity} • booked {sl.booked_count}</li>)}</ul>
        </div>
      </section>

      <section style={{marginTop:24, border:"1px solid #eee", borderRadius:12, padding:16}}>
        <h2 style={{fontSize:18, marginBottom:8}}>📒 Recent Bookings</h2>
        {!bookings.length && <p>No bookings yet.</p>}
        <ul>{bookings.map(b => <li key={b.id}>{b.service} @ {b.start_ts} — {b.status} <span style={{opacity:.6}}>(chat {b.chat_id})</span></li>)}</ul>
      </section>
    </main>
  )
}
