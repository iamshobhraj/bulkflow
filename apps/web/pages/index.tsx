import React, { useEffect, useState } from "react";
import { AuthGate } from "../components/AuthGate";
import ServiceSelect from "../components/ServiceSelect";
import ServiceForm from "../components/ServiceForm";
import SlotForm from "../components/SlotForm";
import SlotsTable from "../components/SlotsTable";
import BookingsTable from "../components/BookingsTable";
import { Service, Slot, Booking } from "../types";
import { api } from "../lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export default function Admin() {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setMsg("");
    try {
      const [svc, sl, bk] = await Promise.all([
        api.get("/admin/services/list"),
        api.get("/admin/slots/list", { params: { available: "1" } }),
        api.get("/admin/bookings/recent"),
      ]);
      setServices(svc.data.results || []);
      setSlots(sl.data.results || []);
      setBookings(bk.data.results || []);
      if (!selected && (svc.data.results || []).length) setSelected(svc.data.results[0].id);
    } catch (e:any) {
      setMsg(e?.response?.data || e?.message || "Load failed");
    }
  }
  useEffect(() => { refresh(); }, []);

  async function seed() {
    setBusy(true); setMsg("");
    try { await api.post("/admin/seed"); setMsg("Seeded demo data."); await refresh(); }
    catch (e:any) { setMsg(e?.response?.data || e?.message || "Seed failed"); }
    finally { setBusy(false); }
  }

  return (
    <AuthGate>
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold">
          BulkFlow Admin
          <span className="ml-3 text-gray-500">API: {API_BASE || "(relative /api)"}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} disabled={busy} className="border rounded-md px-3 py-2 hover:bg-gray-50">Refresh</button>
          <button onClick={seed} disabled={busy} className="border rounded-md px-3 py-2 hover:bg-gray-50">Seed demo</button>
        </div>
      </div>

      {msg && <p className="bg-yellow-50 border border-yellow-300 rounded p-2 mb-4 text-sm">{msg}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ServiceSelect services={services} selected={selected} onChange={setSelected} />
        <ServiceForm onDone={refresh} onSelect={setSelected} />
        <SlotForm serviceId={selected} onCreated={refresh} />
        <SlotsTable slots={slots} />
        <BookingsTable bookings={bookings} />
      </div>

      <footer className="text-xs text-gray-500 my-6">
        Need raw JSON? <code>GET /admin/slots/list?available=1</code> and <code>GET /admin/bookings/recent</code>
      </footer>
    </AuthGate>
  );
}
